import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SHARED_OWNER, VideoService, simulatedGenerator } from '../src/videos'
import type { GenerationContext, Generator } from '../src/videos'
import type { VideoManifest } from '../../shared/video/contract'
import { parseThumbnailSVG } from '../src/agents/thumbnail'

const services: VideoService[] = [], directories: string[] = []
afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.close()))
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
const request = { title: 'Dots', topic: 'Explain dots', documents: [] }
const scene = (index: number) => ({ audio: new Uint8Array([1]), scene: { id: `scene-${index}`, index, duration: 1, captions: [], source: "export default scene({end:'advance'},s=>{s.circle('dot');s.wait(1);});" } })
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }
async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 300; attempt++) { if (check()) return; await Bun.sleep(10) }
  throw new Error('Progress timed out')
}

test('live snapshots report milestones, completed scenes, and wait for final assets before 100%', async () => {
  const first = deferred(), second = deferred(), artwork = deferred()
  let lateProgress: GenerationContext['onProgress']
  const generate: Generator = async (_request, index, context) => {
    lateProgress = context!.onProgress
    if (index >= 2) return null
    await (index === 0 ? first.promise : second.promise)
    context!.onProgress?.({ stage: 'narration', sceneIndex: index, totalScenes: 2 })
    context!.onProgress?.({ stage: 'scene', sceneIndex: index, totalScenes: 2 })
    context!.onProgress?.({ stage: 'validating', sceneIndex: index, totalScenes: 2 })
    return scene(index)
  }
  const service = new VideoService(':memory:', generate, 'pi', async () => {
    await artwork.promise
    return parseThumbnailSVG('<svg viewBox="0 0 420 270"><path d="M100 200Q200 130 280 80"/></svg>')
  }); services.push(service)
  const video = service.create(SHARED_OWNER, 'progress', request)
  const initial = structuredClone(video)
  const stream = await service.handle(new Request(`http://localhost/api/videos/${video.id}/events`))
  const events = stream.text()
  try {
    expect(initial.progress).toMatchObject({ stage: 'queued', percent: 0, completedScenes: 0 })
    first.resolve()
    await waitFor(() => service.get(video.id, SHARED_OWNER)!.scenes.length === 1)
    expect(service.get(video.id, SHARED_OWNER)!.progress).toMatchObject({ completedScenes: 1, totalScenes: 2 })
    second.resolve()
    await waitFor(() => service.get(video.id, SHARED_OWNER)!.scenes.length === 2)
    const finalizing = service.get(video.id, SHARED_OWNER)!
    expect(finalizing.status).toBe('generating')
    expect(finalizing.progress?.stage).toBe('finalizing')
    expect(finalizing.progress!.percent).toBeLessThan(100)
    artwork.resolve()
    const snapshots = (await events).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)) as VideoManifest)
    expect(snapshots.some(snapshot => snapshot.progress?.stage === 'scene')).toBe(true)
    expect(snapshots.some(snapshot => snapshot.progress?.stage === 'validating')).toBe(true)
    for (let i = 1; i < snapshots.length; i++) expect(snapshots[i].progress!.percent).toBeGreaterThanOrEqual(snapshots[i - 1].progress!.percent)
    expect(snapshots.every(snapshot => snapshot.progress!.completedScenes === snapshot.scenes.length)).toBe(true)
    expect(snapshots.filter(snapshot => snapshot.status !== 'complete').every(snapshot => snapshot.progress!.percent < 100)).toBe(true)
    const complete = service.get(video.id, SHARED_OWNER)!
    expect(complete.progress).toMatchObject({ stage: 'complete', percent: 100, completedScenes: 2, totalScenes: 2 })
    lateProgress?.({ stage: 'scene', sceneIndex: 0 })
    expect(service.get(video.id, SHARED_OWNER)).toEqual(complete)
  } finally { first.resolve(); second.resolve(); artwork.resolve(); await events }
})

test('failed progress retains its estimate and rejects late updates', async () => {
  let lateProgress: GenerationContext['onProgress']
  const service = new VideoService(':memory:', async (_request, _index, context) => {
    lateProgress = context!.onProgress
    context!.onProgress?.({ stage: 'validating', sceneIndex: 0, totalScenes: 1 })
    throw new Error('Failed validation')
  }); services.push(service)
  const video = service.create(SHARED_OWNER, 'failure', request)
  await waitFor(() => service.get(video.id, SHARED_OWNER)!.status === 'failed')
  const failed = service.get(video.id, SHARED_OWNER)!
  expect(failed.progress?.stage).toBe('failed')
  expect(failed.progress!.percent).toBeGreaterThan(0)
  expect(failed.progress!.percent).toBeLessThan(100)
  lateProgress?.({ stage: 'script' })
  expect(service.get(video.id, SHARED_OWNER)).toEqual(failed)
})

test('persisted progress survives a resumed job without going backwards', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aha-progress-')); directories.push(directory)
  const path = join(directory, 'videos.sqlite')
  let reached = false
  const first = new VideoService(path, async (_request, _index, context) => {
    context!.onProgress?.({ stage: 'validating', sceneIndex: 0, totalScenes: 2 }); reached = true
    await new Promise<void>(resolve => context!.signal.addEventListener('abort', () => resolve(), { once: true }))
    return scene(0)
  }); services.push(first)
  const video = first.create(SHARED_OWNER, 'resume', request)
  await waitFor(() => reached)
  const before = first.get(video.id, SHARED_OWNER)!.progress
  await first.close(); services.splice(services.indexOf(first), 1)
  const gate = deferred(); let resumed = false
  const second = new VideoService(path, async (_request, index, context) => {
    context!.onProgress?.({ stage: 'script' }); resumed = true
    await gate.promise
    return index >= 2 ? null : scene(index)
  }); services.push(second)
  try {
    await waitFor(() => resumed)
    expect(before).toBeDefined()
    expect(second.get(video.id, SHARED_OWNER)!.progress!.percent).toBeGreaterThanOrEqual(before!.percent)
    expect(second.get(video.id, SHARED_OWNER)!.progress?.totalScenes).toBe(2)
    gate.resolve()
    await waitFor(() => second.get(video.id, SHARED_OWNER)!.status === 'complete')
  } finally { gate.resolve() }
})

test('deleting a job makes late progress callbacks harmless', async () => {
  const gate = deferred(); let context: GenerationContext | undefined
  const service = new VideoService(':memory:', async (_request, _index, current) => { context = current; await gate.promise; return scene(0) }); services.push(service)
  const video = service.create(SHARED_OWNER, 'deleted', request)
  try {
    await waitFor(() => !!context)
    expect(context!.onProgress).toBeFunction()
    service.delete(video.id)
    expect(() => context!.onProgress?.({ stage: 'scene', totalScenes: 1 })).not.toThrow()
    expect(service.get(video.id, SHARED_OWNER)).toBeUndefined()
  } finally { gate.resolve() }
})

test('the simulated generator supplies its scene count, capped for an insertion', async () => {
  for (const insertion of [false, true]) {
    const updates: { totalScenes?: number }[] = []
    await simulatedGenerator({ ...request, ...(insertion ? { sceneRequest: true } : {}) }, 0, {
      videoId: crypto.randomUUID(), owner: SHARED_OWNER, signal: new AbortController().signal, onProgress: update => updates.push(update),
    })
    expect(updates.some(update => update.totalScenes === (insertion ? 1 : 3))).toBe(true)
  }
})
