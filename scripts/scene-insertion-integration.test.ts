import { expect, spyOn, test } from 'bun:test'
import { createPlayer } from '../shared/animlib/dist/player.js'
import { CanvasRenderer } from '../shared/animlib/dist/renderer.js'
import type { Frame } from '../shared/animlib/dist/types.js'
import { Canvas } from '../shared/animlib/test/canvas-stub'
import { LessonPlayback } from '../frontend/app/src/lessonPlayback'
import { listSceneRequests, requestScenes } from '../frontend/app/src/sceneRequests'
import type { SceneRequestInput } from '../shared/video/scene-requests'
import { SHARED_OWNER, VideoService } from '../backend/src/videos'
import type { Generator } from '../backend/src/videos'

// Exercise the production service, request helpers, playback adapter, Player,
// compiler, sequence and audio registry together. Only browser devices and the
// generation provider are simulated; no network or paid generation is used.
const first = `export default scene({ end: 'advance' }, s => {
  const x = s.slider('x', { min: 0, max: 5, default: 1 });
  s.keep(s.circle('original', { position: [x, 0] })); s.wait(1);
});`
const movingFirst = `export default scene({ end: 'advance' }, s => {
  const dot = s.circle('original');
  s.bind(dot, [s.time], time => ({ position: [time, 0, 0] })); s.wait(1);
});`
const second = `export default scene({ end: 'advance' }, s => { s.wait(1); });`
const followup = `export default scene({ end: 'advance' }, s => {
  const size = s.slider('size', { min: 1, max: 4, default: 2 });
  s.circle('followup', { radius: size }); s.wait(1);
});`

function gate() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

async function waitFor(check: () => boolean, message = 'Timed out waiting for the simulated generation') {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (check()) return
    await Bun.sleep(10)
  }
  throw new Error(message)
}

const input = (lessonId: string, sceneId = 'scene-0', question = 'Explain this with a toy'): SceneRequestInput => ({
  question, context: {
    lessonId, lessonTitle: 'Insertion integration', subject: 'Math', time: .5, label: 'Original dot',
    point: { x: 200, y: 150 }, normalizedPoint: { x: .5, y: .5 }, surface: { width: 400, height: 300 },
    scene: { id: sceneId, time: .5, frame: { elements: [{ id: 'original', position: [3, 0, 0] }] }, controls: [{ id: 'x', value: 3 }] },
  },
})

async function harness(fail = false, options: { autoplay?: boolean; loadManifest?: boolean; firstSource?: string } = {}) {
  let now = 0, nextFrame = 0
  let rendered: Frame | undefined
  const frames = new Map<number, FrameRequestCallback>()
  const gates: ReturnType<typeof gate>[] = []
  const audioGates = new Map<string, ReturnType<typeof gate> & { entered: boolean }>()
  const requests: Parameters<Generator>[0][] = []
  const downloads: string[] = []
  const audioStarts: number[] = []
  const audioContexts: { state: string }[] = []
  let audioResumeAllowed = true
  const restoreGlobals: (() => void)[] = []
  function install(name: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })
    restoreGlobals.push(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : Reflect.deleteProperty(globalThis, name))
  }
  install('ResizeObserver', class { observe() {} disconnect() {} })
  install('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
  install('cancelAnimationFrame', (id: number) => { frames.delete(id) })
  install('AudioContext', class {
    constructor() { audioContexts.push(this) }
    state = 'running'
    destination = {}
    get currentTime() { return now / 1000 }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} } }
    async decodeAudioData(bytes: ArrayBuffer) { expect(bytes.byteLength).toBeGreaterThan(0); return { duration: 1 } }
    createBufferSource() { return { connect() {}, disconnect() {}, stop() {}, start(_at: number, offset: number) { audioStarts.push(offset) } } }
    async resume() { if (audioResumeAllowed) this.state = 'running' }
    async close() {}
  })
  const clock = spyOn(performance, 'now').mockImplementation(() => now)
  const prepare = spyOn(CanvasRenderer.prototype, 'prepare').mockImplementation(async () => {})
  const render = spyOn(CanvasRenderer.prototype, 'render').mockImplementation(frame => { rendered = structuredClone(frame) })
  const generator: Generator = async (request, index) => {
    if (request.sceneRequest) {
      requests.push(request)
      const pending = gate(); gates.push(pending)
      await pending.promise
      if (fail) throw new Error('Simulated provider failure')
    } else if (index >= 2) return null
    return {
      audio: new Uint8Array([1, 2, 3]),
      scene: { id: `scene-${index}`, index, source: request.sceneRequest ? followup : index ? second : options.firstSource ?? first, duration: 1, captions: [] },
    }
  }
  const service = new VideoService(':memory:', generator)
  const originalFetch = globalThis.fetch
  install('fetch', async (resource: string | URL | Request, init?: RequestInit) => {
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
      downloads.push(resource)
      const blocked = audioGates.get(resource)
      if (blocked) { blocked.entered = true; await blocked.promise }
      return service.handle(new Request(`http://localhost${resource}`, init))
    }
    return originalFetch(resource, init)
  })
  const player = createPlayer({ canvas: new Canvas() as unknown as HTMLCanvasElement, controlsRoot: false })
  const playback = new LessonPlayback(player, options.autoplay ?? true)
  const parent = service.create(SHARED_OWNER, 'integration-parent', { title: 'Insertion integration', topic: 'Teach vectors', documents: [] })
  await waitFor(() => service.get(parent.id, SHARED_OWNER)?.status === 'complete')
  if (options.loadManifest !== false) {
    await playback.acceptManifest(service.get(parent.id, SHARED_OWNER)!)
    expect(playback.getState().error).toBe('')
    expect(playback.getState().ready).toBe(true)
  }
  return {
    service, player, playback, parent, requests, gates, downloads, audioStarts,
    interruptAudio(allowResume = true) { audioContexts.at(-1)!.state = 'suspended'; audioResumeAllowed = allowResume },
    holdAudio(url: string) {
      const blocked = { ...gate(), entered: false }
      audioGates.set(url, blocked)
      return blocked
    },
    frame: () => rendered!,
    async advance(seconds: number) {
      now += seconds * 1000
      const pending = [...frames.values()]; frames.clear()
      pending.forEach(callback => callback(now))
      // Production playback starts the next audio track asynchronously.
      await Promise.resolve(); await Promise.resolve()
    },
    async accept() { await playback.acceptSceneRequests(await listSceneRequests(parent.id)) },
    async ready(index = 0) {
      await waitFor(() => gates.length > index)
      gates[index].release()
      await waitFor(() => service.sceneRequests(parent.id)[index]?.video.status === (fail ? 'failed' : 'complete'))
    },
    async close() {
      gates.forEach(pending => pending.release())
      audioGates.forEach(pending => pending.release())
      playback.dispose()
      await service.close()
      render.mockRestore(); prepare.mockRestore(); clock.mockRestore()
      restoreGlobals.reverse().forEach(restore => restore())
    },
  }
}

test('Play recovers interrupted browser audio in place and keeps controls through repeated permission blocks', async () => {
  const h = await harness()
  try {
    await h.player.setControl({ scene: 'scene-0', id: 'x', value: 3 })
    await h.advance(.25)
    h.interruptAudio(false)
    await h.advance(.1)
    const offset = h.playback.getState().sceneTime
    expect(h.playback.getState()).toMatchObject({ playing: false, ready: true, error: '', wantsPlay: false })
    expect(h.playback.getState().playbackNotice).toContain('interrupted')
    await h.playback.toggle()
    expect(h.playback.getState()).toMatchObject({ playing: false, ready: true, error: '', wantsPlay: false, sceneTime: offset })
    expect(h.playback.getState().playbackNotice).toContain('blocked')
    h.interruptAudio(true)
    await h.playback.toggle()
    expect(h.playback.getState()).toMatchObject({ playing: true, error: '', playbackNotice: '', wantsPlay: true, sceneTime: offset })
    expect(h.player.getState().controls.find(control => control.id === 'x')?.value).toBe(3)
    expect(h.audioStarts.at(-1)).toBe(offset)
  } finally { await h.close() }
})

test('request -> generation -> real Player waits, plays a nested insertion, and restores the original handoff', async () => {
  const h = await harness()
  try {
    await h.player.setControl({ scene: 'scene-0', id: 'x', value: 3 })
    const requested = await requestScenes(input(h.parent.id), 'followup')
    expect((await requestScenes(input(h.parent.id), 'followup')).id).toBe(requested.id)
    await h.accept()
    await h.advance(1)
    expect(h.playback.getState()).toMatchObject({ waitingForInsertion: true, wantsPlay: true, ended: false, playing: false })
    const startsAtBoundary = h.audioStarts.length
    await h.advance(3)
    expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: 1, status: 'ended' })
    expect(h.audioStarts).toHaveLength(startsAtBoundary)

    await h.ready(); await h.accept()
    const added = `${requested.id}:scene-0`
    expect(h.player.getState()).toMatchObject({ scene: added, time: 0, status: 'playing' })
    expect(h.player.getState().scenes.map(scene => scene.id)).toEqual(['scene-0', added, 'scene-1'])
    expect(h.frame().elements.map(element => element.id)).toEqual(['followup'])
    await h.player.setControl({ scene: added, id: 'size', value: 4 })
    expect(h.frame().elements[0].geometry.radius).toBe(4)

    const nested = await requestScenes(input(h.parent.id, added, 'Explain the new toy'), 'nested')
    await h.accept(); await h.advance(1)
    expect(h.playback.getState().waitingForInsertion).toBe(true)
    await h.ready(1); await h.accept()
    expect(h.player.getState()).toMatchObject({ scene: `${nested.id}:scene-0`, time: 0, status: 'playing' })
    expect(h.player.getState().scenes.map(scene => scene.id)).toEqual(['scene-0', added, `${nested.id}:scene-0`, 'scene-1'])
    await h.advance(1)
    expect(h.player.getState()).toMatchObject({ scene: 'scene-1', time: 0, status: 'playing' })
    expect(h.frame().elements.find(element => element.id === 'original')?.position).toEqual([3, 0, 0])
    expect(h.frame().elements.some(element => element.id === 'followup')).toBe(false)
    await h.advance(1)
    expect(h.playback.getState()).toMatchObject({ ended: true, playing: false, error: '', insertionError: '' })
    await h.accept()
    expect(h.player.getState().scenes).toHaveLength(4)
    for (const scene of h.service.sceneRequests(h.parent.id).flatMap(request => request.video.scenes)) {
      expect(h.downloads).toContain(scene.audio.url)
    }
    const selected = JSON.parse(h.requests[1].documents.at(-1)!.text)
    expect(selected.selectedScene.source).toBe(followup)
    expect(h.service.list()).toHaveLength(1)
  } finally { await h.close() }
})

test('failed generation releases the real Player barrier into the original continuation', async () => {
  const h = await harness(true)
  try {
    await requestScenes(input(h.parent.id), 'failure')
    await h.accept(); await h.advance(1)
    expect(h.playback.getState().waitingForInsertion).toBe(true)
    await h.ready(); await h.accept()
    expect(h.player.getState()).toMatchObject({ scene: 'scene-1', time: 0, status: 'playing' })
    expect(h.player.getState().scenes.map(scene => scene.id)).toEqual(['scene-0', 'scene-1'])
    expect(h.playback.getState()).toMatchObject({ waitingForInsertion: false, error: '' })
    expect((await listSceneRequests(h.parent.id))[0].video).toMatchObject({ status: 'failed', errorCode: 'GENERATION' })
    await h.advance(1)
    expect(h.playback.getState().ended).toBe(true)
  } finally { await h.close() }
})

test('a late insertion preserves the real Player moment, controls, overlay and manual pause', async () => {
  const h = await harness()
  try {
    await h.player.setControl({ scene: 'scene-0', id: 'x', value: 4 })
    await h.playback.seek(1.5)
    await h.playback.pause()
    await h.playback.setSuspended(true)
    const requested = await requestScenes(input(h.parent.id), 'late')
    await h.accept(); await h.ready(); await h.accept()
    expect(h.player.getState()).toMatchObject({ scene: 'scene-1', time: .5, status: 'paused' })
    expect(h.frame().elements.find(element => element.id === 'original')?.position).toEqual([4, 0, 0])
    expect(h.playback.getState()).toMatchObject({ time: 2.5, duration: 3, wantsPlay: false, playing: false, insertionError: '' })
    await h.playback.setSuspended(false)
    expect(h.player.getState().status).toBe('paused')
    await h.playback.playScene(`${requested.id}:scene-0`)
    expect(h.player.getState()).toMatchObject({ scene: `${requested.id}:scene-0`, time: 0, status: 'playing' })
  } finally { await h.close() }
})

for (const intent of ['manual pause', 'overlay'] as const) {
  test(`Play animates the prepared first scene before saved-scene audio finishes and preserves ${intent}`, async () => {
    const h = await harness(false, { autoplay: false, loadManifest: false, firstSource: movingFirst })
    const manifest = h.service.get(h.parent.id, SHARED_OWNER)!
    const blocked = h.holdAudio(manifest.scenes[1].audio.url)
    const loading = h.playback.acceptManifest(manifest)
    let changedIntent: Promise<void> | undefined
    let toggled: Promise<void> | undefined
    try {
      await waitFor(() => blocked.entered)
      expect(h.playback.getState()).toMatchObject({ ready: true, playing: false, wantsPlay: false, error: '' })
      expect(h.player.getState().scenes.map(scene => scene.id)).toEqual(['scene-0'])
      expect(h.audioStarts).toHaveLength(0)
      expect(h.frame().elements.find(element => element.id === 'original')?.position[0]).toBe(0)

      toggled = h.playback.toggle()
      await waitFor(() => h.playback.getState().playing)
      expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: 0, status: 'playing' })
      expect(h.player.getState().scenes).toHaveLength(1)
      expect(h.audioStarts).toEqual([0])
      // Checking only transport time misses a worker sample queued behind the
      // pending append: audio can advance while the displayed frame is frozen.
      for (const time of [.125, .25]) {
        await h.advance(.125)
        expect(h.player.getState().time).toBe(time)
        await waitFor(() => h.frame().elements.find(element => element.id === 'original')?.position[0] === time,
          'Ready scene animation froze behind the second audio fetch')
        expect(h.player.getState().scenes).toHaveLength(1)
      }

      changedIntent = intent === 'manual pause' ? h.playback.pause() : h.playback.setSuspended(true)
      expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: .25, status: 'paused' })
      await h.advance(.25)
      expect(h.player.getState().time).toBe(.25)
      expect(h.frame().elements.find(element => element.id === 'original')?.position[0]).toBe(.25)
      blocked.release()
      await loading; await changedIntent; await toggled
      expect(h.player.getState().scenes.map(scene => scene.id)).toEqual(['scene-0', 'scene-1'])
      expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: .25, status: 'paused' })
      expect(h.frame().elements.find(element => element.id === 'original')?.position[0]).toBe(.25)
      expect(h.playback.getState()).toMatchObject({ duration: 2, playing: false, wantsPlay: intent === 'overlay', error: '' })
      expect(h.audioStarts).toEqual([0])

      await h.playback.setSuspended(false)
      if (intent === 'overlay') {
        expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: .25, status: 'playing' })
        expect(h.audioStarts).toEqual([0, .25])
      } else {
        expect(h.player.getState()).toMatchObject({ scene: 'scene-0', time: .25, status: 'paused' })
        expect(h.audioStarts).toEqual([0])
      }
    } finally {
      blocked.release()
      await loading; await changedIntent; await toggled
      await h.close()
    }
  })
}
