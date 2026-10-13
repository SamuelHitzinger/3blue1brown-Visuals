import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSceneRequests, watchSceneRequestList } from '../src/sceneRequests.ts'
import type { SceneRequest } from '../../../shared/video/scene-requests.ts'

const request = (id: string, revision = 1): SceneRequest => ({ id, afterSceneId: 'first', question: 'Explain this',
  video: { schemaVersion: 1, id, title: 'Follow-up', revision, status: 'generating', provider: 'simulated', createdAt: '', scenes: [] } })
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
function browser() {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const window = new EventTarget(), document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true })
  return { window, document, restore() {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window')
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document')
  } }
}

test('returning to a lesson discovers another tab’s insertion without restarting playback', async () => {
  const surface = browser(), fetch = globalThis.fetch
  let saved: SceneRequest[] = [], calls = 0, current: SceneRequest[] = [], connection = 'old failure'
  globalThis.fetch = async () => { calls++; return Response.json(saved) }
  const stop = watchSceneRequestList('lesson', requests => { current = mergeSceneRequests(current, requests) }, message => { connection = message })
  try {
    await settle(); assert.equal(calls, 1); assert.deepEqual(current, [])
    saved = [request('other-tab')]
    surface.window.dispatchEvent(new Event('focus'))
    await settle(); assert.equal(current[0]?.id, 'other-tab'); assert.equal(connection, '')
    surface.document.visibilityState = 'hidden'
    surface.document.dispatchEvent(new Event('visibilitychange'))
    await settle(); assert.equal(calls, 2)
    saved = [request('other-tab', 3), request('newer-tab')]
    surface.document.visibilityState = 'visible'
    surface.document.dispatchEvent(new Event('visibilitychange'))
    await settle(); assert.deepEqual(current.map(item => [item.id, item.video.revision]), [['other-tab', 3], ['newer-tab', 1]])
    stop(); surface.window.dispatchEvent(new Event('focus')); await settle(); assert.equal(calls, 3)
  } finally { stop(); surface.restore(); globalThis.fetch = fetch }
})

test('refresh merges by revision and retains submissions newer than the list snapshot', () => {
  const newer = request('saved', 8), local = request('local', 2), other = request('other', 3)
  const current = [newer, local]
  assert.deepEqual(mergeSceneRequests(current, [request('saved', 4), other]), [newer, other, local])
  const recovered = { ...request('saved', 9), video: { ...request('saved', 9).video, status: 'complete' as const } }
  assert.deepEqual(mergeSceneRequests(current, [recovered]), [recovered, local])
  assert.equal(mergeSceneRequests(current, [request('saved', 8)]), current)
})

test('focus bursts allow one request in flight and one fresh snapshot; disposal rejects late results', async () => {
  const surface = browser(), fetch = globalThis.fetch
  const releases: ((response: Response) => void)[] = []
  let calls = 0, publications = 0
  globalThis.fetch = async () => { calls++; return new Promise<Response>(resolve => { releases.push(resolve) }) }
  const stop = watchSceneRequestList('lesson', () => { publications++ }, () => {})
  try {
    for (let i = 0; i < 10; i++) surface.window.dispatchEvent(new Event('focus'))
    assert.equal(calls, 1)
    releases[0](Response.json([])); await settle()
    assert.equal(calls, 2); assert.equal(publications, 1)
    stop(); releases[1](Response.json([request('late')]))
    await settle(); assert.equal(publications, 1); assert.equal(calls, 2)
  } finally { stop(); releases.forEach(release => release(Response.json([]))); surface.restore(); globalThis.fetch = fetch }
})

test('a failed list refresh keeps existing scenes and can recover on the next focus', async () => {
  const surface = browser(), fetch = globalThis.fetch
  let available = false, current = [request('saved')], connection = ''
  globalThis.fetch = async () => available ? Response.json([request('saved', 2)]) : Response.json({ detail: 'Unavailable' }, { status: 503 })
  const stop = watchSceneRequestList('lesson', saved => { current = mergeSceneRequests(current, saved) }, message => { connection = message })
  try {
    await settle(); assert.equal(current[0].video.revision, 1); assert.match(connection, /Could not load/)
    available = true; surface.window.dispatchEvent(new Event('focus')); await settle()
    assert.equal(current[0].video.revision, 2); assert.equal(connection, '')
  } finally { stop(); surface.restore(); globalThis.fetch = fetch }
})
