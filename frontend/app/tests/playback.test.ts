import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Color, compileSource, evaluateScene } from 'animlib'
import type { PlayerState, SceneSource, Submission, SubmitResult } from 'animlib'
import { LessonPlayback, scenePosition, sequenceTime } from '../src/lessonPlayback.ts'
import { lessonScenes } from '../src/lessonScenes.ts'
import { lessons } from './fixtures/lessons.ts'
import type { SceneRequest } from '../../../shared/video/scene-requests.ts'
import { sceneRequestTimeline, sceneRequestBarriers } from '../src/sceneRequests.ts'
import type { VideoManifest } from '../../../shared/video/contract.ts'

class TestPlayer {
  state: PlayerState = { revision: 0, scene: null, time: 0, duration: 0, status: 'empty', scenes: [], controls: [], orbitEnabled: false }
  disposed = false
  calls: string[] = []
  result: SubmitResult = { ok: true, revision: 1, diagnostics: [] }
  submitGate: Promise<void> = Promise.resolve()
  listeners = new Set<(state: PlayerState) => void>()
  emit(change: Partial<PlayerState>) {
    assert.equal(this.disposed, false, 'no player operations after disposal')
    Object.assign(this.state, change)
    this.listeners.forEach(listener => listener(this.state))
  }
  async submit(_change: Submission) {
    await this.submitGate
    if (this.disposed) return this.result
    this.emit({ scene: 'first', scenes: [{ id: 'first', duration: 10 }, { id: 'second', duration: 20 }], duration: 10, status: 'paused' })
    return this.result
  }
  async seek(position: { scene: string; time: number }) {
    this.calls.push(`seek:${position.scene}:${position.time}`)
    this.emit({ ...position, duration: position.scene === 'first' ? 10 : 20, status: 'paused' })
  }
  async play() { this.calls.push('play'); this.emit({ status: 'playing' }) }
  pause() { this.calls.push('pause'); this.emit({ status: 'paused' }) }
  subscribe(listener: (state: PlayerState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => { this.listeners.delete(listener) }
  }
  dispose() { this.disposed = true }
}
const sources: SceneSource[] = [{ id: 'first', source: '' }, { id: 'second', source: '' }]

test('sequence progress maps boundaries, clamped seeks, and final frames correctly', () => {
  const player = new TestPlayer()
  player.state.scenes = [{ id: 'first', duration: 10 }, { id: 'second', duration: 20 }]
  assert.deepEqual(scenePosition(player.state.scenes, -4), { scene: 'first', time: 0 })
  assert.deepEqual(scenePosition(player.state.scenes, 10), { scene: 'second', time: 0 })
  assert.deepEqual(scenePosition(player.state.scenes, 50), { scene: 'second', time: 20 })
  assert.equal(sequenceTime({ ...player.state, scene: 'second', time: 8 }), 18)
})

test('restores initial progress, follows animlib clock, and resumes a playing seek', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  await playback.load(sources, 12)
  assert.equal(playback.getState().time, 12)
  assert.equal(playback.getState().playing, true)
  player.emit({ time: 5 })
  assert.equal(playback.getState().time, 15)
  await playback.seek(22)
  assert.equal(playback.getState().time, 22)
  assert.equal(playback.getState().playing, true)
  await playback.toggle()
  await playback.seek(5)
  assert.equal(playback.getState().playing, false)
  playback.dispose()
})

test('overlays pause and resume user intent, including an overlay during loading', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  await playback.setSuspended(true)
  await playback.load(sources)
  assert.equal(playback.getState().playing, false)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, true)
  await playback.toggle()
  await playback.setSuspended(true)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, false, 'closing a menu preserves an intentional pause')
  playback.dispose()
})

test('seeking to the end holds the final frame and replay restarts playback', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  await playback.load(sources)
  await playback.seek(30)
  assert.equal(playback.getState().ended, true)
  assert.equal(playback.getState().playing, false)
  await playback.toggle()
  assert.equal(playback.getState().time, 0)
  assert.equal(playback.getState().playing, true)
  player.emit({ scene: 'second', time: 20, duration: 20, status: 'ended' })
  assert.equal(playback.getState().ended, true)
  await playback.setSuspended(true)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, false)
  playback.dispose()
})

test('an intermediate scene hold pauses user intent until Play is pressed', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  await playback.load(sources)
  player.emit({ scene: 'first', time: 10, duration: 10, status: 'ended' })
  assert.equal(playback.getState().ended, false, 'the sequence still has another scene')
  await playback.setSuspended(true)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, false, 'closing a menu must not replay a held scene')
  await playback.toggle()
  assert.equal(playback.getState().playing, true, 'the first Play click resumes')
  playback.dispose()
})

test('reports compilation and device failures without running a fake timeline', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  player.result = { ok: false, revision: 0, diagnostics: [{ severity: 'error', code: 'SUBMISSION', message: 'No WebGPU adapter' }] }
  await playback.load(sources)
  assert.equal(playback.getState().ready, false)
  assert.equal(playback.getState().error, 'No WebGPU adapter')
  assert.equal(player.calls.includes('play'), false)
  playback.dispose()
  const second = new TestPlayer(), ready = new LessonPlayback(second)
  await ready.load(sources)
  second.emit({ status: 'blocked', error: 'Device lost' })
  assert.equal(ready.getState().playing, false)
  assert.equal(ready.getState().error, 'Device lost')
  ready.dispose()
})

test('disposal cancels pending initialization and detaches subscriptions', async () => {
  const player = new TestPlayer(), playback = new LessonPlayback(player)
  let release = () => {}
  player.submitGate = new Promise(resolve => { release = resolve })
  const loading = playback.load(sources)
  await Promise.resolve()
  playback.dispose()
  release()
  await loading
  assert.equal(player.disposed, true)
  assert.equal(player.listeners.size, 0)
  assert.equal(player.calls.length, 0)
})

test('every sample lesson compiles into a deterministic animlib timeline with matching duration', async () => {
  for (const lesson of [...lessons, { ...lessons[0], id: 'idea-test', title: 'Convergent sequences', subject: 'Analysis', artwork: 'idea' as const, demo: true, duration: 120 }]) {
    for (const background of [Color.WHITE, Color.BLACK]) {
      const [source] = lessonScenes(lesson, { background, ink: Color.GREY_E, accent: Color.BLUE_E })
      const scene = await compileSource(source.source)
      assert.equal(scene.duration, lesson.duration, lesson.id)
      assert.equal(scene.options.background, background)
      const middle = evaluateScene(scene, scene.duration / 2)
      assert.ok(middle.elements.length > 0, lesson.id)
      assert.deepEqual(evaluateScene(scene, scene.duration / 2), middle)
      assert.notDeepEqual(evaluateScene(scene, 0).elements, middle.elements, lesson.id)
    }
  }
})

class StreamingPlayer extends TestPlayer {
  barriers: string[] = []
  setSceneBarriers(ids: string[]) { this.barriers = ids }
  async seek(position: { scene: string; time: number }) {
    this.calls.push(`seek:${position.scene}:${position.time}`)
    this.emit({ ...position, duration: this.state.scenes.find(scene => scene.id === position.scene)!.duration, status: 'paused' })
  }
  async submit(change: Submission) {
    await this.submitGate
    if (change.type === 'insert') {
      const scenes = [...this.state.scenes]
      const at = change.after === null ? 0 : scenes.findIndex(scene => scene.id === change.after) + 1
      scenes.splice(at, 0, ...change.scenes.map(scene => ({ id: scene.id, duration: 10 })))
      this.emit({ scenes, scene: this.state.scene ?? scenes[0].id, duration: 10, status: this.state.scene ? this.state.status : 'paused' })
    }
    return this.result
  }
}
const manifest = (count: number, complete = false): VideoManifest => ({
  schemaVersion: 1, id: 'video', title: 'Test', revision: count + (complete ? 1 : 0), status: complete ? 'complete' : 'generating', provider: 'simulated', createdAt: '',
  scenes: Array.from({ length: count }, (_, index) => ({ id: index ? 'second' : 'first', index, source: '', duration: 10, audio: { id: `audio-${index}`, url: '/audio' }, captions: [] })),
})

test('streaming buffers at the available edge, resumes at the next scene, and ends only on completion', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(1))
  player.emit({ time: 10, status: 'ended' })
  assert.equal(playback.getState().ended, false)
  assert.equal(playback.getState().buffering, true)
  await playback.acceptManifest(manifest(2))
  assert.equal(player.state.scene, 'second')
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  player.emit({ time: 10, status: 'ended' })
  await playback.acceptManifest(manifest(2, true))
  assert.equal(playback.getState().ended, true)
  assert.equal(playback.getState().buffering, false)
  playback.dispose()
})

test('pausing while buffering survives a reconnect snapshot and duplicate delivery', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(1))
  player.emit({ time: 10, status: 'ended' })
  await playback.toggle()
  await playback.acceptManifest(manifest(2))
  await playback.acceptManifest(manifest(2))
  assert.equal(player.state.scenes.length, 2)
  assert.equal(playback.getState().playing, false)
  assert.equal(playback.getState().ended, false)
  await playback.toggle()
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

test('a generation failure preserves playable scenes and reports its message separately', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player, false)
  await playback.acceptManifest({ ...manifest(1), status: 'failed', error: 'Generation failed' })
  assert.equal(playback.getState().ready, true)
  assert.equal(playback.getState().generationError, 'Generation failed')
  assert.equal(playback.getState().error, '')
  await playback.toggle()
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

test('reaching the boundary while the next scene is preparing resumes without replaying', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(1))
  let release!: () => void
  player.submitGate = new Promise(resolve => { release = resolve })
  const append = playback.acceptManifest(manifest(2))
  await Promise.resolve()
  player.emit({ time: 10, status: 'ended' })
  release(); await append
  assert.equal(player.state.scene, 'second')
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

const addition = (id = 'followup', afterSceneId = 'first'): SceneRequest => ({
  id, afterSceneId, question: 'Elaborate on this', video: { ...manifest(2, true), id },
})

test('inserting and replaying a follow-up preserves the active moment, pause intent, original suffix, and deduplicates', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player, false)
  await playback.acceptManifest(manifest(2, true))
  await playback.seek(15)
  await playback.setSuspended(true)
  await playback.acceptSceneRequests([addition()])
  assert.deepEqual(player.state.scenes.map(s => s.id), ['first', 'followup:first', 'followup:second', 'second'])
  assert.equal(player.state.scene, 'second')
  assert.equal(player.state.time, 5)
  assert.equal(playback.getState().duration, 40)
  assert.equal(playback.getState().playing, false)
  await playback.acceptSceneRequests([addition()])
  assert.equal(player.state.scenes.length, 4)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, false)
  await playback.playScene('followup:first')
  assert.equal(player.state.scene, 'followup:first')
  assert.equal(playback.getState().sceneId, 'followup:first')
  assert.equal(playback.getState().sceneTime, 0)
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

test('progressive original scenes append after additions and nested requests attach to their target', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(1))
  await playback.acceptSceneRequests([addition()])
  await playback.acceptManifest(manifest(2, true))
  await playback.acceptSceneRequests([addition(), addition('nested', 'followup:first')])
  assert.deepEqual(player.state.scenes.map(s => s.id), ['first', 'followup:first', 'nested:first', 'nested:second', 'followup:second', 'second'])
  assert.equal(playback.getState().error, '')
  playback.dispose()
})

test('timeline restoration retains independent audio bindings and original scene handoffs', () => {
  const base = [{ id: 'first', source: '', handoffFrom: null }, { id: 'second', source: '', handoffFrom: 'first' }]
  const timeline = sceneRequestTimeline(base, [addition(), addition('another')])
  assert.deepEqual(timeline.map(s => s.id), ['first', 'followup:first', 'followup:second', 'another:first', 'another:second', 'second'])
  assert.equal(timeline[1].handoffFrom, null)
  assert.equal(timeline[2].handoffFrom, 'followup:first')
  assert.equal(timeline.at(-1)?.handoffFrom, 'first')
  assert.notEqual(timeline[1].audioId, timeline[3].audioId)
})

test('a failed added asset does not block later original scenes or discard user playback intent', async () => {
  class FailedAdditionPlayer extends StreamingPlayer {
    async submit(change: Submission) {
      if (change.type === 'insert' && change.scenes.some(s => s.id.startsWith('followup:'))) {
        return { ok: false, revision: 0, diagnostics: [{ severity: 'error' as const, code: 'ASSET', message: 'Audio unavailable' }] }
      }
      return super.submit(change)
    }
  }
  const player = new FailedAdditionPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(1))
  await playback.acceptSceneRequests([addition()])
  assert.equal(playback.getState().insertionError, 'Audio unavailable')
  assert.equal(playback.getState().error, '')
  await playback.acceptManifest(manifest(2, true))
  assert.deepEqual(player.state.scenes.map(s => s.id), ['first', 'second'])
  assert.equal(playback.getState().playing, true)
  assert.equal(playback.getState().error, '')
  playback.dispose()
})

const pendingAddition = (count = 0, status: VideoManifest['status'] = 'generating', afterSceneId = 'first'): SceneRequest => ({
  ...addition('followup', afterSceneId), video: { ...manifest(count), id: 'followup', status },
})

test('waits at insertion boundaries and resumes through progressively prepared additions', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(2, true))
  await playback.acceptSceneRequests([pendingAddition()])
  assert.deepEqual(player.barriers, ['first'])
  player.emit({ scene: 'first', time: 10, duration: 10, status: 'ended' })
  assert.equal(playback.getState().waitingForInsertion, true)
  assert.equal(playback.getState().wantsPlay, true)
  assert.equal(playback.getState().ended, false)
  await playback.acceptSceneRequests([pendingAddition(1)])
  assert.equal(player.state.scene, 'followup:first')
  assert.equal(playback.getState().sceneId, 'followup:first')
  assert.equal(playback.getState().sceneTime, 0)
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  assert.deepEqual(player.barriers, ['followup:first'])
  player.emit({ time: 10, status: 'ended' })
  assert.equal(playback.getState().waitingForInsertion, true)
  await playback.acceptSceneRequests([pendingAddition(2, 'complete')])
  assert.equal(player.state.scene, 'followup:second')
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  assert.equal(playback.getState().waitingForInsertion, false)
  assert.deepEqual(player.barriers, [])
  playback.dispose()
})

test('keeps a manual pause while waiting and after the insertion becomes ready', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(2, true))
  await playback.acceptSceneRequests([pendingAddition()])
  player.emit({ time: 10, status: 'ended' })
  await playback.toggle()
  await playback.acceptSceneRequests([pendingAddition(1, 'complete')])
  assert.equal(player.state.scene, 'followup:first')
  assert.equal(playback.getState().sceneId, 'followup:first')
  assert.equal(playback.getState().sceneTime, 0)
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, false)
  assert.equal(playback.getState().wantsPlay, false)
  await playback.toggle()
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

test('keeps waiting until the added scene assets are prepared and respects overlays', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(2, true))
  await playback.acceptSceneRequests([pendingAddition()])
  player.emit({ time: 10, status: 'ended' })
  let release!: () => void
  player.submitGate = new Promise(resolve => { release = resolve })
  const preparing = playback.acceptSceneRequests([pendingAddition(1, 'complete')])
  await Promise.resolve()
  assert.deepEqual(player.barriers, ['first'])
  assert.equal(playback.getState().waitingForInsertion, true)
  const overlay = playback.setSuspended(true)
  release(); await preparing; await overlay
  assert.equal(player.state.scene, 'followup:first')
  assert.equal(playback.getState().playing, false)
  await playback.setSuspended(false)
  assert.equal(playback.getState().playing, true)
  playback.dispose()
})

test('a failed request releases the waiting boundary into the original continuation', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player)
  await playback.acceptManifest(manifest(2, true))
  await playback.acceptSceneRequests([pendingAddition()])
  player.emit({ time: 10, status: 'ended' })
  await playback.acceptSceneRequests([pendingAddition(0, 'failed')])
  assert.equal(player.state.scene, 'second')
  assert.equal(player.state.time, 0)
  assert.equal(playback.getState().playing, true)
  assert.equal(playback.getState().waitingForInsertion, false)
  playback.dispose()
})

test('pending additions at the final scene preserve playback intent until ready or failed', async () => {
  for (const status of ['complete', 'failed'] as const) {
    const player = new StreamingPlayer(), playback = new LessonPlayback(player)
    await playback.acceptManifest(manifest(1, true))
    await playback.acceptSceneRequests([pendingAddition()])
    player.emit({ time: 10, status: 'ended' })
    assert.equal(playback.getState().ended, false)
    assert.equal(playback.getState().wantsPlay, true)
    await playback.acceptSceneRequests([pendingAddition(status === 'complete' ? 1 : 0, status)])
    assert.equal(playback.getState().waitingForInsertion, false)
    assert.equal(playback.getState().ended, status === 'failed')
    assert.equal(playback.getState().playing, status === 'complete')
    playback.dispose()
  }
})

test('seeking away from a waiting boundary cancels the pending automatic jump', async () => {
  for (const position of [4, 15]) {
    const player = new StreamingPlayer(), playback = new LessonPlayback(player)
    await playback.acceptManifest(manifest(2, true))
    await playback.acceptSceneRequests([pendingAddition()])
    player.emit({ time: 10, status: 'ended' })
    await playback.seek(position)
    await playback.acceptSceneRequests([pendingAddition(1, 'complete')])
    assert.equal(player.state.scene, position === 4 ? 'first' : 'second')
    assert.equal(player.state.time, position === 4 ? 4 : 5)
    assert.equal(playback.getState().playing, true)
    playback.dispose()
  }
})

test('pending groups preserve same-anchor order and nested insertion boundaries', () => {
  const ready = addition('ready')
  const nested = { ...pendingAddition(), id: 'nested', afterSceneId: 'ready:first' }
  const prepared = new Set(['first', 'second', 'ready:first', 'ready:second'])
  assert.deepEqual([...sceneRequestBarriers(sources, [pendingAddition(), ready, nested], prepared)], ['first', 'ready:first'])
  assert.deepEqual([...sceneRequestBarriers(sources, [pendingAddition(0, 'failed'), ready, nested], prepared)], ['ready:first'])
})


test('frequent usage-only snapshots preserve scenes, time, and playback intent', async () => {
  const player = new StreamingPlayer(), playback = new LessonPlayback(player, false)
  const first = manifest(1)
  await playback.acceptManifest(first)
  player.emit({ time: 3, status: 'paused' })
  const priorCalls = [...player.calls]
  for (let revision = 2; revision < 10; revision++) {
    await playback.acceptManifest({ ...first, revision, tokenUsage: { inputTokens: 50, outputTokens: 20, totalTokens: 70, estimatedOutputTokens: revision * 10 } })
  }
  assert.equal(player.state.scenes.length, 1)
  assert.equal(playback.getState().time, 3)
  assert.equal(playback.getState().playing, false)
  assert.deepEqual(player.calls, priorCalls)
  await playback.toggle()
  await playback.acceptManifest({ ...first, revision: 10, tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150, estimatedOutputTokens: 0 } })
  assert.equal(playback.getState().playing, true)
  assert.equal(playback.getState().time, 3)
  playback.dispose()
})

test('registers model assets with audio before compiling a streamed scene', async () => {
  const player=new StreamingPlayer();
  const calls:string[]=[];
  const asset={kind:'model' as const,url:'/api/models/hash.glb',metadata:{version:1 as const,parts:[],primitives:[],bounds:{min:[0,0,0] as [number,number,number],max:[1,1,1] as [number,number,number]},triangles:1,materials:[]}};
  const registered:Record<string,unknown>[]=[];
  Object.assign(player,{registerAssets:(assets:Record<string,unknown>)=>{calls.push('assets');registered.push(assets);}});
  const submit=player.submit.bind(player);player.submit=async change=>{calls.push('submit');return submit(change);};
  const playback=new LessonPlayback(player),video=manifest(1);video.scenes[0].assets={model:asset};
  try{await playback.acceptManifest(video);assert.deepEqual(calls,['assets','submit']);assert.deepEqual(registered[0].model,asset);assert.deepEqual(registered[0]['base:audio-0'],{kind:'audio',url:'/audio'});}finally{playback.dispose();}
});
