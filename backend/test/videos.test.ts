import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { AgentError } from '../src/agents/config'
import { SHARED_OWNER, VideoService } from '../src/videos'
import type { Generator } from '../src/videos'
import { parseThumbnailSVG } from '../src/agents/thumbnail'

const services: VideoService[] = []
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.close())) })
const source = "export default scene({ end: 'advance' }, s => { const x = s.slider('x', { min: 0, max: 3, default: 1 }); s.circle('dot', { position: [x, 0] }); s.wait(1); });"
const fixture: Generator = async (_request, index) => index >= 2 ? null : ({ audio: new Uint8Array([1, 2, 3]), scene: { id: `scene-${index}`, index, duration: 1, source, captions: [] } })
const input = { title: 'Vectors', topic: 'Explain vectors', documents: [] }
const thumbnail = parseThumbnailSVG('<svg viewBox="0 0 420 270"><path d="M100 200Q200 130 280 80"/></svg>')
const api = (path = '', init?: RequestInit) => new Request(`http://localhost/api/videos${path}`, init)
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 300; i++) { if (check()) return; await Bun.sleep(10) }
  throw new Error('Timed out waiting for generation')
}

test('videos start independently, deduplicate active jobs, and cancel only the deleted video', async () => {
  const started = new Map<string, number>()
  const signals = new Map<string, AbortSignal>()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(':memory:', async (request, index, context) => {
    if (index === 0) {
      started.set(context!.videoId, (started.get(context!.videoId) ?? 0) + 1)
      signals.set(context!.videoId, context!.signal)
      await Promise.race([gate, new Promise<void>(resolve => context!.signal.addEventListener('abort', () => resolve(), { once: true }))])
    }
    return fixture(request, index)
  }); services.push(service)
  try {
    const first = service.create(SHARED_OWNER, 'first', input)
    await waitFor(() => started.has(first.id))
    const others = Array.from({ length: 4 }, (_, i) => service.create(SHARED_OWNER, `other-${i}`, input))
    expect(service.create(SHARED_OWNER, 'first', input).id).toBe(first.id)
    await waitFor(() => started.size === 5)
    expect([...started.values()]).toEqual([1, 1, 1, 1, 1])
    service.delete(first.id)
    expect(signals.get(first.id)!.aborted).toBe(true)
    expect(others.every(video => !signals.get(video.id)!.aborted)).toBe(true)
    release()
    await waitFor(() => others.every(video => service.get(video.id, SHARED_OWNER)?.status === 'complete'))
    for (const video of others) expect(service.get(video.id, SHARED_OWNER)!.scenes.map(scene => scene.index)).toEqual([0, 1])
    expect(service.get(first.id, SHARED_OWNER)).toBeUndefined()
  } finally { release() }
})

test('shutdown drains all active videos and restart resumes them concurrently', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-concurrent-resume-'))
  const started = new Set<string>(), aborted = new Set<string>()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(join(dir, 'db'), async (request, index, context) => {
    if (index === 1) {
      started.add(context!.videoId)
      await new Promise<void>(resolve => context!.signal.addEventListener('abort', () => { aborted.add(context!.videoId); resolve() }, { once: true }))
    }
    return fixture(request, index)
  }); services.push(service)
  try {
    const videos = Array.from({ length: 3 }, (_, i) => service.create(SHARED_OWNER, `video-${i}`, input))
    await waitFor(() => started.size === 3)
    await service.close(); services.splice(services.indexOf(service), 1)
    expect(aborted.size).toBe(3)
    const resumed = new Map<string, number>()
    const reopened = new VideoService(join(dir, 'db'), async (request, index, context) => {
      if (!resumed.has(context!.videoId)) resumed.set(context!.videoId, index)
      await gate
      return fixture(request, index)
    }); services.push(reopened)
    await waitFor(() => resumed.size === 3)
    expect([...resumed.values()]).toEqual([1, 1, 1])
    release()
    await waitFor(() => videos.every(video => reopened.get(video.id, SHARED_OWNER)?.status === 'complete'))
  } finally {
    release()
    await Promise.all(services.splice(0).map(service => service.close()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('JSON and multipart creation always generate interactive videos, including older clients', async () => {
  const received: unknown[] = []
  const service = new VideoService(':memory:', async request => { received.push(request.videoMode); return null }); services.push(service)
  for (const multipart of [false, true]) {
    for (const videoMode of ['classic', 'interactive', undefined]) {
      const key = `${multipart}-${videoMode}`
      const post = (mode: unknown) => {
        const payload = JSON.stringify({ ...input, videoMode: mode })
        const form = new FormData(); form.set('request', payload)
        if (multipart) form.append('files', new File(['Source notes'], 'notes.txt'))
        return api('', { method: 'POST', headers: { 'Idempotency-Key': key }, body: multipart ? form : payload })
      }
      const response = await service.handle(post(videoMode))
      expect(response.status).toBe(202)
      const video = await response.json()
      await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete')
      expect(received.at(-1)).toBe('interactive')
      expect((await (await service.handle(post(videoMode))).json()).id).toBe(video.id)
      expect((await (await service.handle(post(videoMode === 'interactive' ? 'classic' : 'interactive'))).json()).id).toBe(video.id)
      expect((await (await service.handle(post(undefined))).json()).id).toBe(video.id)
      for (const invalid of ['unknown', '', null, true, 1, {}]) {
        expect((await service.handle(post(invalid))).status).toBe(400)
      }
    }
  }
  expect(received).toEqual(Array(6).fill('interactive'))
})

test('saved jobs retain their original mode on retry and restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-saved-mode-'))
  const path = join(dir, 'db')
  const service = new VideoService(path, async () => null); services.push(service)
  try {
    const modes = ['classic', undefined] as const
    const videos = modes.map((_, i) => service.create(SHARED_OWNER, `saved-${i}`, input))
    await waitFor(() => videos.every(video => service.get(video.id, SHARED_OWNER)?.status === 'complete'))
    await service.close(); services.splice(services.indexOf(service), 1)
    // Reproduce records persisted before interaction became the default.
    const db = new Database(path)
    try {
      videos.forEach((video, i) => db.query('UPDATE videos SET request = ?, manifest = ? WHERE id = ?')
        .run(JSON.stringify({ ...input, videoMode: modes[i] }), JSON.stringify(video), video.id))
    } finally { db.close() }
    const received: unknown[] = []
    const reopened = new VideoService(path, async request => { received.push(request.videoMode); return null }); services.push(reopened)
    for (const [i, video] of videos.entries()) {
      expect(reopened.create(SHARED_OWNER, `saved-${i}`, { ...input, videoMode: 'interactive' }).id).toBe(video.id)
      expect(() => reopened.create(SHARED_OWNER, `saved-${i}`, { ...input, topic: 'A different topic' })).toThrow('Idempotency')
    }
    await waitFor(() => videos.every(video => reopened.get(video.id, SHARED_OWNER)?.status === 'complete'))
    expect(received).toEqual([...modes])
  } finally {
    await Promise.all(services.splice(0).map(service => service.close()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('video creation retains more than ten uploaded, JSON, or combined documents', async () => {
  for (const [fileCount, documentCount] of [[12, 0], [0, 12], [6, 6]]) {
    let received: { name: string; text: string }[] | undefined
    const service = new VideoService(':memory:', async request => { received = request.documents; return null }); services.push(service)
    const documents = Array.from({ length: documentCount }, (_, i) => ({ name: `document-${i}.md`, text: `Document ${i} describes a basis.` }))
    const files = Array.from({ length: fileCount }, (_, i) => new File([`File ${i} describes a vector.`], `file-${i}.md`))
    const payload = JSON.stringify({ ...input, topic: '', documents })
    const form = new FormData(); form.set('request', payload)
    for (const file of files) form.append('files', file)
    const response = await service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'many-documents' }, body: fileCount ? form : payload }))
    expect(response.status).toBe(202)
    const video = await response.json()
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete')
    expect(received).toEqual([...documents, ...await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })))])
  }
})

test('large JSON and multipart video sources reach the worker intact', async () => {
  const text = 'Vector coordinates. '.repeat(60_000);
  for (const multipart of [false, true]) {
    let received: { name: string; text: string }[] | undefined
    const service = new VideoService(':memory:', async request => { received = request.documents; return null }); services.push(service)
    const documents = [{ name: 'notes.md', text }]
    const payload = JSON.stringify({ ...input, topic: '', documents })
    const form = new FormData(); form.set('request', payload)
    form.append('files', new File([text], 'lecture.txt'))
    const response = await service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'large-source' }, body: multipart ? form : payload }))
    expect(response.status).toBe(202)
    const video = await response.json()
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete')
    expect(received).toEqual(multipart ? [...documents, { name: 'lecture.txt', text }] : documents)
  }
})

test('video failures use user-facing messages in live events and preserve ready scenes', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(':memory:', async (request, index) => {
    if (index === 1) { await gate; throw new AgentError('PROVIDER', 'Check agents:check. Authorization: Bearer private-token') }
    return fixture(request, index)
  }); services.push(service)
  const video = service.create(SHARED_OWNER, 'failed', input)
  try {
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.scenes.length === 1)
    const response = await service.handle(api(`/${video.id}/events`))
    const events = response.text()
    release()
    const text = await events
    const manifest = service.get(video.id, SHARED_OWNER)!
    expect(manifest.status).toBe('failed')
    expect(manifest.errorCode).toBe('PROVIDER')
    expect(manifest.error).toBe("We couldn't finish creating this video. Please try creating it again. You can still watch the parts that are ready.")
    expect(text).toContain(JSON.stringify(manifest))
    expect(text).not.toMatch(/agents:check|Authorization|private-token/)
    expect(manifest.scenes).toHaveLength(1)
    expect((await service.handle(new Request(`http://localhost${manifest.scenes[0].audio.url}`))).status).toBe(200)
    expect(await (await service.handle(api(`/${video.id}`))).json()).toEqual(manifest)
    expect(await (await service.handle(api())).json()).toEqual([manifest])
  } finally { release() }
})

test('operator and unknown error messages never enter video responses', async () => {
  for (const code of ['AUTH', 'MODEL', 'CONFIG', 'NARRATION', 'LIMIT', 'VALIDATION', 'DOCUMENT', undefined]) {
    const service = new VideoService(':memory:', async () => {
      if (code) throw new AgentError(code, 'Stop the backend, check AGENT_MODEL, OPENAI_API_KEY and agents:login; private-detail')
      throw new Error('private-detail')
    }); services.push(service)
    const video = service.create(SHARED_OWNER, 'failed', input)
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'failed')
    const manifest = await (await service.handle(api(`/${video.id}`))).json()
    expect(manifest.error).not.toMatch(/backend|AGENT_MODEL|OPENAI_API_KEY|agents:login|private-detail/)
    expect(manifest.error).not.toContain('parts that are ready')
    if (['AUTH', 'MODEL', 'CONFIG', 'NARRATION'].includes(code ?? '')) expect(manifest.error).toContain('currently unavailable')
    if (code === 'LIMIT') expect(manifest.error).toContain('try again later')
    if (code === 'DOCUMENT') expect(manifest.error).toContain('split it into smaller videos')
  }
})

test('legacy saved errors are sanitized for reads, lists, events and idempotent creation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-legacy-error-'))
  const path = join(dir, 'videos.sqlite')
  const original = new VideoService(path, async () => { throw new Error('Fail') })
  try {
    const video = original.create(SHARED_OWNER, 'legacy', input)
    await waitFor(() => original.get(video.id, SHARED_OWNER)?.status === 'failed')
    await original.close()
    const db = new Database(path)
    try {
      const legacy = { ...video, status: 'failed', error: 'The agent request failed. Check agents:check and retry the job.' }
      db.query('UPDATE videos SET manifest = ? WHERE id = ?').run(JSON.stringify(legacy), video.id)
    } finally { db.close() }
    const service = new VideoService(path, async () => { throw new Error('Must not regenerate') })
    try {
      const manifest = service.get(video.id, SHARED_OWNER)!
      expect(manifest.error).toBe("We couldn't finish creating this video. Please try creating it again.")
      expect(service.list()).toEqual([manifest])
      expect(service.create(SHARED_OWNER, 'legacy', input)).toEqual(manifest)
      expect(await (await service.handle(api(`/${video.id}`))).json()).toEqual(manifest)
      expect(await (await service.handle(api())).json()).toEqual([manifest])
      expect(await (await service.handle(api(`/${video.id}/events`))).text()).not.toContain('agents:check')
    } finally { await service.close() }
  } finally { await original.close().catch(() => {}); await rm(dir, { recursive: true, force: true }) }
})

test('thumbnail generation overlaps scenes, persists, and finishes before the terminal event', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-thumbnails-'))
  let release!: () => void, calls = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(join(dir, 'db'), fixture, 'pi', async request => {
    calls++; expect(request.topic).toBe(input.topic); await gate; return thumbnail
  }); services.push(service)
  try {
    const video = service.create(SHARED_OWNER, 'one', input)
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.scenes.length === 2)
    expect(service.get(video.id, SHARED_OWNER)?.thumbnailStatus).toBe('generating')
    expect(service.get(video.id, SHARED_OWNER)?.status).toBe('generating')
    release()
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete')
    expect(service.get(video.id, SHARED_OWNER)?.thumbnail).toEqual(thumbnail)
    const events = await service.handle(api(`/${video.id}/events`))
    expect(await events.text()).toContain('"thumbnailStatus":"complete"')
    await service.close(); services.splice(services.indexOf(service), 1)
    const reopened = new VideoService(join(dir, 'db'), fixture, 'pi', async () => { calls++; return thumbnail }); services.push(reopened)
    expect(reopened.get(video.id, SHARED_OWNER)?.thumbnail).toEqual(thumbnail)
    expect(calls).toBe(1)
  } finally { release(); await Promise.all(services.splice(0).map(s => s.close())); await rm(dir, { recursive: true, force: true }) }
})

test('thumbnail failure preserves playable videos and does not stop the queue', async () => {
  const service = new VideoService(':memory:', fixture, 'pi', async () => { throw new Error('private provider error') }); services.push(service)
  const first = service.create(SHARED_OWNER, 'one', input), second = service.create(SHARED_OWNER, 'two', input)
  await waitFor(() => [first, second].every(video => service.get(video.id, SHARED_OWNER)?.status === 'complete'))
  const video = service.get(first.id, SHARED_OWNER)!
  expect(video).toMatchObject({ status: 'complete', thumbnailStatus: 'failed' })
  expect(video.scenes).toHaveLength(2)
  expect(video.thumbnail).toBeUndefined()
  expect(JSON.stringify(video)).not.toContain('private provider error')
})

test('deleting a video cancels its thumbnail and prevents late publication', async () => {
  let started = false, aborted = false
  const service = new VideoService(':memory:', fixture, 'pi', async (_request, context) => {
    started = true
    await new Promise<void>((_, reject) => context.signal.addEventListener('abort', () => { aborted = true; reject(context.signal.reason) }, { once: true }))
    return thumbnail
  }); services.push(service)
  const video = service.create(SHARED_OWNER, 'one', input)
  await waitFor(() => started)
  service.delete(video.id)
  await waitFor(() => aborted)
  expect(service.get(video.id, SHARED_OWNER)).toBeUndefined()
})

test('interrupted thumbnails resume while completed thumbnails are reused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-thumbnail-resume-'))
  let started = false
  const service = new VideoService(join(dir, 'db'), fixture, 'pi', async (_request, context) => {
    started = true
    await new Promise<void>((_, reject) => context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true }))
    return thumbnail
  }); services.push(service)
  try {
    const video = service.create(SHARED_OWNER, 'one', input)
    await waitFor(() => started)
    await service.close(); services.splice(services.indexOf(service), 1)
    let calls = 0
    const reopened = new VideoService(join(dir, 'db'), fixture, 'pi', async () => { calls++; return thumbnail }); services.push(reopened)
    await waitFor(() => reopened.get(video.id, SHARED_OWNER)?.status === 'complete')
    expect(reopened.get(video.id, SHARED_OWNER)?.thumbnail).toEqual(thumbnail)
    expect(calls).toBe(1)
  } finally { await Promise.all(services.splice(0).map(s => s.close())); await rm(dir, { recursive: true, force: true }) }
})

test('creation is idempotent, shared, durable and publishes assets before scenes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-videos-'))
  try {
    const service = new VideoService(join(dir, 'videos.sqlite'), fixture); services.push(service)
    const response = await service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'one' }, body: JSON.stringify(input) }))
    expect(response.status).toBe(202)
    const cookie = 'aha-session=' + crypto.randomUUID()
    const video = await response.json()
    const again = await service.handle(api('', { method: 'POST', headers: { cookie, 'Idempotency-Key': 'one' }, body: JSON.stringify(input) }))
    expect((await again.json()).id).toBe(video.id)
    expect((await service.handle(api(`/${video.id}`))).status).toBe(200)
    const owner = SHARED_OWNER
    await waitFor(() => service.get(video.id, owner)?.status === 'complete')
    const manifest = service.get(video.id, owner)!
    expect(manifest.scenes.map(scene => scene.index)).toEqual([0, 1])
    for (const scene of manifest.scenes) expect((await service.handle(new Request(`http://localhost${scene.audio.url}`, { headers: { cookie } }))).status).toBe(200)
    const events = await service.handle(api(`/${video.id}/events`, { headers: { cookie, 'Last-Event-ID': '1' } }))
    expect(await events.text()).toContain(JSON.stringify(manifest))
    await service.close(); services.splice(services.indexOf(service), 1)
    const reopened = new VideoService(join(dir, 'videos.sqlite'), fixture); services.push(reopened)
    expect(reopened.get(video.id, owner)).toEqual(manifest)
    expect(reopened.list(owner)).toHaveLength(1)
  } finally { await Promise.all(services.splice(0).map(service => service.close())); await rm(dir, { recursive: true, force: true }) }
})

test('unfinished jobs resume after restart and subscriptions do not own generation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-resume-'))
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(join(dir, 'db'), async (request, index) => { if (index === 1) await gate; return fixture(request, index) }); services.push(service)
  const responseCreated = await service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'one' },
    body: JSON.stringify({ ...input, videoMode: 'interactive' }) }))
  expect(responseCreated.status).toBe(202)
  const video = await responseCreated.json()
  await waitFor(() => service.get(video.id, SHARED_OWNER)?.scenes.length === 1)
  const abort = new AbortController()
  const response = await service.handle(api(`/${video.id}/events`, { headers: { 'x-user-id': 'a' }, signal: abort.signal }))
  const reader = response.body!.getReader()
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('scene-0')
  abort.abort()
  const closing = service.close(); release(); await closing; services.splice(services.indexOf(service), 1)
  const reopened = new VideoService(join(dir, 'db'), async (request, index) => {
    expect(request.videoMode).toBe('interactive')
    return fixture(request, index)
  }); services.push(reopened)
  await waitFor(() => reopened.get(video.id, SHARED_OWNER)?.status === 'complete')
  expect(reopened.get(video.id, SHARED_OWNER)?.scenes).toHaveLength(2)
  await reopened.close(); services.splice(services.indexOf(reopened), 1)
  await rm(dir, { recursive: true, force: true })
})

test('invalid requests and idempotency conflicts are rejected', async () => {
  const service = new VideoService(':memory:', async () => null); services.push(service)
  const headers = { 'x-user-id': 'a', 'Idempotency-Key': 'one' }
  expect((await service.handle(api('', { method: 'POST', headers, body: '{}' }))).status).toBe(400)
  expect((await service.handle(api('', { method: 'POST', headers: { ...headers, origin: 'https://other.test' }, body: JSON.stringify(input) }))).status).toBe(403)
  await service.handle(api('', { method: 'POST', headers, body: JSON.stringify(input) }))
  expect((await service.handle(api('', { method: 'POST', headers, body: JSON.stringify({ ...input, title: 'Different' }) }))).status).toBe(409)
  expect((await service.handle(api('', { method: 'POST', headers: { ...headers, origin: 'https://localhost', 'x-forwarded-proto': 'https' }, body: JSON.stringify(input) }))).status).toBe(202)
})

test('configured public origin permits proxied writes while rejecting other origins and cross-site requests', async () => {
  const previousOrigin = process.env.NARRATION_PUBLIC_ORIGIN
  const publicOrigin = 'https://11.hackathon.ethz.ch'
  process.env.NARRATION_PUBLIC_ORIGIN = publicOrigin
  try {
    const service = new VideoService(':memory:', async () => null); services.push(service)
    const headers = { 'Idempotency-Key': 'proxied', origin: publicOrigin, 'sec-fetch-site': 'same-origin' }
    const internalURL = 'http://app:8080/api/videos'
    const response = await service.handle(new Request(internalURL, { method: 'POST', headers, body: JSON.stringify(input) }))
    expect(response.status).toBe(202)
    const video = await response.json()
    for (const method of ['POST', 'DELETE']) {
      const url = method === 'POST' ? internalURL : `${internalURL}/${video.id}`
      for (const origin of ['https://evil.test', 'http://11.hackathon.ethz.ch', 'http://app:8080']) {
        expect((await service.handle(new Request(url, { method, headers: { ...headers, origin } }))).status).toBe(403)
      }
      expect((await service.handle(new Request(url, { method, headers: { ...headers, 'sec-fetch-site': 'cross-site' } }))).status).toBe(403)
    }
    expect((await service.handle(new Request(`${internalURL}/${video.id}`, { method: 'DELETE', headers: { ...headers, 'x-forwarded-proto': 'http' } }))).status).toBe(204)
  } finally {
    if (previousOrigin === undefined) delete process.env.NARRATION_PUBLIC_ORIGIN
    else process.env.NARRATION_PUBLIC_ORIGIN = previousOrigin
  }
})

test('multipart uploads are durable, extracted in the worker, and included in idempotency', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-uploads-'))
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const received: string[] = []
  const service = new VideoService(join(dir, 'db'), async (request, index) => {
    received.push(request.documents[0].text)
    await gate
    return fixture(request, index)
  }); services.push(service)
  const post = (text: string) => {
    const form = new FormData()
    form.set('request', JSON.stringify({ ...input, topic: '' }))
    form.append('files', new File([text], 'notes.md', { type: 'text/markdown' }))
    return service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'upload' }, body: form }))
  }
  try {
    const created = await post('Vectors have direction.')
    expect(created.status).toBe(202)
    const video = await created.json()
    expect((await (await post('Vectors have direction.')).json()).id).toBe(video.id)
    expect((await post('Changed content, same filename.')).status).toBe(409)
    await waitFor(() => received.length > 0)
    expect(received[0]).toBe('Vectors have direction.')
    const closing = service.close(); release(); await closing; services.splice(services.indexOf(service), 1)
    const restarted = new VideoService(join(dir, 'db'), async (request, index) => {
      expect(request.documents).toEqual([{ name: 'notes.md', text: 'Vectors have direction.' }])
      return fixture(request, index)
    }); services.push(restarted)
    await waitFor(() => restarted.get(video.id, SHARED_OWNER)?.status === 'complete')
    expect((await (await restarted.handle(api('', { headers: { 'x-user-id': 'another-user' } }))).json())[0].id).toBe(video.id)
  } finally { release(); await Promise.all(services.splice(0).map(service => service.close())); await rm(dir, { recursive: true, force: true }) }
})

test('deleting an active video closes its subscription, removes assets, and keeps the queue running', async () => {
  let pending = false, aborted = false
  const service = new VideoService(':memory:', async (request, index, context) => {
    if (request.title === 'Delete me' && index === 1) {
      pending = true
      await new Promise<void>((_, reject) => context!.signal.addEventListener('abort', () => { aborted = true; reject(context!.signal.reason) }, { once: true }))
    }
    return fixture(request, index)
  }); services.push(service)
  const video = service.create(SHARED_OWNER, 'delete', { ...input, title: 'Delete me' })
  const next = service.create(SHARED_OWNER, 'next', input)
  await waitFor(() => pending)
  const audioURL = service.get(video.id, SHARED_OWNER)!.scenes[0].audio.url
  const events = await service.handle(api(`/${video.id}/events`))
  const reader = events.body!.getReader()
  await reader.read()
  expect((await service.handle(api(`/${video.id}`, { method: 'DELETE', headers: { origin: 'https://evil.test' } }))).status).toBe(403)
  expect((await service.handle(api(`/${video.id}`, { method: 'DELETE' }))).status).toBe(204)
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: deleted')
  expect((await reader.read()).done).toBe(true)
  await waitFor(() => service.get(next.id, SHARED_OWNER)?.status === 'complete')
  expect(aborted).toBe(true)
  expect(service.get(video.id, SHARED_OWNER)).toBeUndefined()
  expect((await service.handle(new Request(`http://localhost${audioURL}`))).status).toBe(404)
  expect(service.list()).toHaveLength(1)
})

test('archiving is idempotent and durable, retaining assets until permanent deletion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-archive-'))
  const path = join(dir, 'videos.sqlite')
  try {
    const service = new VideoService(path, fixture); services.push(service)
    const video = service.create(SHARED_OWNER, 'archive', input, [{ name: 'notes.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode('Vectors have direction.') }])
    await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete')
    const original = service.get(video.id, SHARED_OWNER)!
    const response = await service.handle(api(`/${video.id}/archive`, { method: 'POST' }))
    expect(response.status).toBe(200)
    const archived = await response.json()
    expect(archived.archivedAt).toBeString()
    expect(Number.isFinite(Date.parse(archived.archivedAt))).toBe(true)
    expect(archived.revision).toBe(original.revision + 1)
    expect(archived.scenes).toEqual(original.scenes)
    expect(archived.status).toBe('complete')
    expect(await (await service.handle(api(`/${video.id}/archive`, { method: 'POST' }))).json()).toEqual(archived)
    expect(service.create(SHARED_OWNER, 'archive', input)).toEqual(archived)
    await service.close(); services.splice(services.indexOf(service), 1)

    const reopened = new VideoService(path, fixture); services.push(reopened)
    expect(reopened.get(video.id, SHARED_OWNER)).toEqual(archived)
    expect(await (await reopened.handle(api())).json()).toEqual([archived])
    for (const scene of archived.scenes) expect((await reopened.handle(new Request(`http://localhost${scene.audio.url}`))).status).toBe(200)
    const db = new Database(path)
    try {
      expect(db.query('SELECT COUNT(*) AS count FROM video_uploads WHERE video = ?').get(video.id)).toEqual({ count: 1 })
      expect((await reopened.handle(api(`/${video.id}`, { method: 'DELETE' }))).status).toBe(204)
      expect(reopened.list()).toEqual([])
      for (const table of ['videos', 'video_audio', 'video_uploads']) {
        expect(db.query(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 })
      }
    } finally { db.close() }
    expect((await reopened.handle(api(`/${video.id}/archive`, { method: 'POST' }))).status).toBe(404)
    expect((await reopened.handle(new Request(`http://localhost${archived.scenes[0].audio.url}`))).status).toBe(404)
  } finally { await Promise.all(services.splice(0).map(service => service.close())); await rm(dir, { recursive: true, force: true }) }
})

test('archiving during generation survives later scene and thumbnail updates without cancelling the job', async () => {
  let release!: () => void, pending = false, cancelled = false
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = new VideoService(':memory:', async (request, index, context) => {
    if (index === 1) {
      pending = true
      await gate
      cancelled = context!.signal.aborted
    }
    return fixture(request, index)
  }, 'pi', async () => { await gate; return thumbnail }); services.push(service)
  try {
    const video = service.create(SHARED_OWNER, 'archive-active', input)
    await waitFor(() => pending)
    const events = await service.handle(api(`/${video.id}/events`))
    const text = events.text()
    const archived = await (await service.handle(api(`/${video.id}/archive`, { method: 'POST' }))).json()
    expect(archived.status).toBe('generating')
    release()
    const snapshots = (await text).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)))
    const archiveIndex = snapshots.findIndex(snapshot => snapshot.archivedAt)
    expect(archiveIndex).toBeGreaterThan(0)
    for (const snapshot of snapshots.slice(archiveIndex)) expect(snapshot.archivedAt).toBe(archived.archivedAt)
    for (let index = 1; index < snapshots.length; index++) expect(snapshots[index].revision).toBeGreaterThan(snapshots[index - 1].revision)
    const completed = service.get(video.id, SHARED_OWNER)!
    expect(completed.status).toBe('complete')
    expect(completed.archivedAt).toBe(archived.archivedAt)
    expect(completed.thumbnail).toEqual(thumbnail)
    expect(completed.scenes).toHaveLength(2)
    expect(cancelled).toBe(false)
  } finally { release() }
})

test('archive writes retain shared-library access and origin protection, including legacy owners', async () => {
  const service = new VideoService(':memory:', fixture); services.push(service)
  const video = service.create('legacy-session-owner', 'archive-legacy', input)
  const forbiddenHeaders: Record<string, string>[] = [{ origin: 'https://evil.test' }, { 'sec-fetch-site': 'cross-site' }]
  for (const headers of forbiddenHeaders) {
    expect((await service.handle(api(`/${video.id}/archive`, { method: 'POST', headers }))).status).toBe(403)
    expect(service.get(video.id, 'legacy-session-owner')?.archivedAt).toBeUndefined()
  }
  expect((await service.handle(api(`/${video.id}/archive`, { method: 'DELETE' }))).status).toBe(405)
  const archived = await (await service.handle(api(`/${video.id}/archive`, { method: 'POST', headers: { 'x-user-id': 'another-user', origin: 'http://localhost' } }))).json()
  expect(archived.archivedAt).toBeString()
  expect(service.get(video.id, 'legacy-session-owner')?.archivedAt).toBe(archived.archivedAt)
  expect(service.get(video.id, 'another-user')).toBeUndefined()
  expect((await service.handle(api('/missing/archive', { method: 'POST' }))).status).toBe(404)
})

test('uploaded photos are passed to the script agent as images', async () => {
  let image: string | undefined
  const service = new VideoService(':memory:', async (_request, _index, context) => { image = context?.images?.[0]?.data; return null }); services.push(service)
  const form = new FormData()
  form.set('request', JSON.stringify({ ...input, topic: '' }))
  form.append('files', new File([new Uint8Array([137, 80, 78, 71])], 'notes.png'))
  const response = await service.handle(api('', { method: 'POST', headers: { 'Idempotency-Key': 'photo' }, body: form }))
  expect(response.status).toBe(202)
  await waitFor(() => Boolean(image))
  expect(image).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'))
})

test('real generation retries without duplicating published scenes or exposing provider errors', async () => {
  const indices: number[] = []; let failures = 0;
  const service = new VideoService(':memory:', async (request, index) => {
    indices.push(index);
    if (index === 1 && failures++ < 4) throw new AgentError('QUOTA', 'private provider detail');
    return fixture(request, index);
  }, 'pi', undefined, { delay: () => 1 }); services.push(service);
  const video = service.create(SHARED_OWNER, 'recover', input);
  await waitFor(() => service.get(video.id, SHARED_OWNER)?.status === 'complete');
  const result = service.get(video.id, SHARED_OWNER)!;
  expect(indices).toEqual([0, 1, 1, 1, 1, 1, 2]);
  expect(result.scenes.map(scene => scene.index)).toEqual([0, 1]);
  expect(result.recovery).toBeUndefined(); expect(result.error).toBeUndefined();
});

test('deletion cancels backoff and shutdown preserves the retry for restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-retry-resume-'));
  let calls = 0;
  const service = new VideoService(join(dir, 'db'), async () => { calls++; throw new AgentError('QUOTA', 'private detail'); }, 'pi');
  services.push(service);
  try {
    const deleted = service.create(SHARED_OWNER, 'deleted', input);
    await waitFor(() => !!service.get(deleted.id, SHARED_OWNER)?.recovery);
    expect(service.get(deleted.id, SHARED_OWNER)?.recovery?.message).toContain('narration');
    service.delete(deleted.id);
    const resumed = service.create(SHARED_OWNER, 'resumed', input);
    await waitFor(() => !!service.get(resumed.id, SHARED_OWNER)?.recovery);
    await service.close(); services.splice(services.indexOf(service), 1);
    expect(calls).toBe(2);
    let waited = 0;
    const reopened = new VideoService(join(dir, 'db'), fixture, 'pi', undefined, { wait: async ms => { waited = ms; } });
    services.push(reopened);
    await waitFor(() => reopened.get(resumed.id, SHARED_OWNER)?.status === 'complete');
    expect(waited).toBeGreaterThan(0); expect(calls).toBe(2);
    expect(reopened.get(deleted.id, SHARED_OWNER)).toBeUndefined();
  } finally {
    await Promise.all(services.splice(0).map(service => service.close()));
    await rm(dir, { recursive: true, force: true });
  }
});
