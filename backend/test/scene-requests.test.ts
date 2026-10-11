import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SHARED_OWNER, VideoService } from '../src/videos'
import type { Generator } from '../src/videos'
import type { SceneRequestInput } from '../../shared/video/scene-requests'

const services: VideoService[] = []
afterEach(async () => { await Promise.all(services.splice(0).map(s => s.close())) })
const source = "export default scene({ end: 'advance' }, s => { s.circle('dot'); s.wait(1); });"
const fixture: Generator = async (_request, index) => index >= 2 ? null : ({ audio: new Uint8Array([1, 2, 3]), scene: { id: `scene-${index}`, index, duration: 1, source, narration: 'A vector has magnitude and direction.', captions: [] } })
const input = (id: string): SceneRequestInput => ({ question: 'Make me an interactive toy for this', context: {
  lessonId: id, lessonTitle: 'Vectors', subject: 'Math', time: .4, label: 'Selected region',
  point: { x: 200, y: 100 }, normalizedPoint: { x: .5, y: .5 }, surface: { width: 400, height: 200 },
  scene: { id: 'scene-0', time: .4, frame: { elements: [{ id: 'dot', position: [1, 0, 0] }] }, controls: [{ id: 'magnitude', value: 2 }] },
} })
const api = (id: string, payload?: unknown, key = 'request-one') => new Request(`http://localhost/api/videos/${id}/scene-requests`, payload === undefined ? {} : {
  method: 'POST', headers: { 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
})
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 300; i++) { if (check()) return; await Bun.sleep(10) }
  throw new Error('Generation timed out')
}

test('contextual requests persist, are idempotent, use authoritative scene context, and stay out of the library', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aha-context-'))
  const received: Parameters<Generator>[0][] = []
  try {
    const service = new VideoService(join(dir, 'db'), async (request, index, context) => {
      if (request.sceneRequest) received.push(request)
      return fixture(request, index, context)
    }); services.push(service)
    const parent = service.create(SHARED_OWNER, 'parent', { title: 'Vectors', topic: 'Explain vectors', narrationMode: 'subtitles', documents: [{ name: 'notes', text: 'Vectors describe displacement.' }] })
    await waitFor(() => service.get(parent.id, SHARED_OWNER)?.status === 'complete')
    const response = await service.handle(api(parent.id, input(parent.id)))
    expect(response.status).toBe(202)
    const request = await response.json()
    expect(request.afterSceneId).toBe('scene-0')
    expect((await (await service.handle(api(parent.id, input(parent.id)))).json()).id).toBe(request.id)
    expect((await service.handle(api(parent.id, { ...input(parent.id), question: 'Different' }))).status).toBe(409)
    await waitFor(() => service.get(request.id, SHARED_OWNER)?.status === 'complete')
    expect(received[0].videoMode).toBe('interactive')
    expect(received[0].narrationMode).toBe('subtitles')
    expect(received[0].documents[0].text).toBe('Vectors describe displacement.')
    const captured = JSON.parse(received[0].documents.at(-1)!.text)
    expect(captured.selectedScene.source).toBe(source)
    expect(captured.selectedScene.narration).toContain('magnitude')
    expect(captured.scene.time).toBe(.4)
    expect(captured.normalizedPoint).toEqual({ x: .5, y: .5 })
    expect(captured.scene.controls[0].value).toBe(2)
    expect(service.list()).toHaveLength(1)
    expect(service.get(parent.id, SHARED_OWNER)?.scenes).toHaveLength(2)
    const saved = service.sceneRequests(parent.id)
    expect(saved[0].video.scenes).toHaveLength(1)
    expect(received).toHaveLength(1)
    expect(received[0].topic).toContain("Create one follow-up scene")
    expect(received[0].topic).not.toMatch(/short|concise|brief|minutes|seconds|word.count/i)
    const audio = saved[0].video.scenes[0].audio.url
    expect((await service.handle(new Request(`http://localhost${audio}`))).status).toBe(200)
    await service.close(); services.splice(services.indexOf(service), 1)
    const restored = new VideoService(join(dir, 'db'), fixture); services.push(restored)
    expect(await (await restored.handle(api(parent.id))).json()).toEqual(saved)
    // Requests can also target a generated follow-up scene in the same lesson.
    const nested = input(parent.id); nested.context.scene!.id = `${request.id}:scene-0`
    expect((await restored.handle(api(parent.id, nested, 'nested'))).status).toBe(202)
    const children = restored.sceneRequests(parent.id).map(r => r.id)
    restored.delete(parent.id)
    for (const child of children) expect(restored.get(child, SHARED_OWNER)).toBeUndefined()
    expect(restored.sceneRequests(parent.id)).toEqual([])
    expect((await restored.handle(new Request(`http://localhost${audio}`))).status).toBe(404)
  } finally {
    await Promise.all(services.splice(0).map(s => s.close()))
    await rm(dir, { recursive: true, force: true })
  }
})

test('local samples accept captured source and generation failures preserve the original lesson', async () => {
  const service = new VideoService(':memory:', async () => { throw new Error('Provider unavailable') }); services.push(service)
  const payload = { ...input('vectors'), localScene: { id: 'scene-0', source, duration: 1 } }
  const response = await service.handle(api('vectors', payload))
  expect(response.status).toBe(202)
  const request = await response.json()
  await waitFor(() => service.get(request.id, SHARED_OWNER)?.status === 'failed')
  expect(service.sceneRequests('vectors')[0].video.status).toBe('failed')
  expect(service.list()).toEqual([])
})

test('invalid context, stale targets, oversized bodies, and cross-site writes are rejected', async () => {
  const service = new VideoService(':memory:', fixture); services.push(service)
  for (const payload of [null, {}, { ...input('demo'), question: ' ' }, { ...input('demo'), context: { ...input('demo').context, normalizedPoint: { x: 2, y: 0 } } }]) {
    expect((await service.handle(api('demo', payload))).status).toBe(400)
  }
  expect((await service.handle(api('demo', input('demo')))).status).toBe(409)
  const payload = { ...input('demo'), localScene: { id: 'scene-0', source, duration: 1 } }
  const crossSite = api('demo', payload); crossSite.headers.set('origin', 'https://evil.test')
  expect((await service.handle(crossSite)).status).toBe(403)
  expect((await service.handle(api('demo', { ...payload, extra: 'x'.repeat(1_000_000) }))).status).toBe(413)
  const parent = service.create(SHARED_OWNER, 'parent', { title: 'Vectors', topic: 'Explain', documents: [] })
  await waitFor(() => service.get(parent.id, SHARED_OWNER)?.status === 'complete')
  const forged = input(parent.id); forged.context.scene!.id = 'missing'
  expect((await service.handle(api(parent.id, { ...forged, localScene: { id: 'missing', source, duration: 1 } }))).status).toBe(409)
})
