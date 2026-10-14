import test from 'node:test'
import assert from 'node:assert/strict'
import { CaptureEngine } from '../src/captureEngine.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 5))
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }

// Only the camera and canvas boundary is synthetic; scheduling, zoom and encoding
// coordination all run through the production engine.
function camera(options: { hardware?: boolean; apply?: (value: number) => Promise<void>; encode?: () => Promise<void>; pixels?: (width: number, height: number) => Uint8ClampedArray } = {}) {
  const original = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const draws: number[][] = [], images: { width: number; height: number; draw: number[] }[] = [], zooms: any[] = [], frames: any[] = []
  let stopped = 0, skipped = 0, hardwareZoom = 1, inFlight = 0, peak = 0
  const track = Object.assign(new EventTarget(), {
    stop: () => { stopped++ }, getCapabilities: () => options.hardware ? { zoom: { min: 1, max: 4, step: .1 } } : {},
    getSettings: () => ({ zoom: hardwareZoom }),
    applyConstraints: async (constraints: any) => { const value = constraints.advanced[0].zoom; await options.apply?.(value); hardwareZoom = value },
  })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const video = { srcObject: null, videoWidth: 1920, videoHeight: 1080, readyState: 4, play: async () => {} }
  const replacements = {
    window: { isSecureContext: true }, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    document: { createElement: () => {
      let draw: number[] = []
      const canvas = { width: 0, height: 0, getContext: () => ({
        drawImage: (_video: unknown, ...args: number[]) => { draw = args; draws.push(args) },
        getImageData: () => ({ width: canvas.width, height: canvas.height, data: options.pixels?.(canvas.width, canvas.height) ?? new Uint8ClampedArray([10, 20, 30, 255]) }),
      }), toBlob: async (done: (blob: Blob) => void) => {
        inFlight++; peak = Math.max(peak, inFlight)
        await options.encode?.(); inFlight--
        done(new Blob([JSON.stringify({ width: canvas.width, height: canvas.height, draw })]))
      } }
      return canvas
    } },
  }
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const engine = new CaptureEngine({ video: video as unknown as HTMLVideoElement, audio: false, photo: true, photoIntervalMs: 30_000,
    canCapture: () => true, onMedia: async media => { images.push(JSON.parse(await media.blob.text())) }, onPaused: () => {},
    onSkipped: () => { skipped++ }, onZoomChanged: state => { zooms.push(state) },
    onFrameChanged: (frame, automatic) => { frames.push({ ...frame, automatic }) },
  })
  return { engine, images, draws, zooms, frames, video, get stopped() { return stopped }, get skipped() { return skipped }, get peak() { return peak },
    async cleanup() { await engine.stop(); for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } },
  }
}

test('digital zoom crops the same centered region for change detection and captured photos without upscaling', async () => {
  const fixture = camera()
  try {
    await fixture.engine.start()
    await fixture.engine.setZoom(2)
    await fixture.engine.takePhoto()
    assert.deepEqual(fixture.images[0], { width: 960, height: 540, draw: [480, 270, 960, 540, 0, 0, 960, 540] })
    assert.deepEqual(fixture.draws[0], [480, 270, 960, 540, 0, 0, 128, 96])
    assert.equal(fixture.zooms.at(-1).digitalScale, 2)
    assert.equal(fixture.zooms.at(-1).mode, 'digital')
    await fixture.engine.setZoom(99)
    assert.equal(fixture.zooms.at(-1).value, 4)
  } finally { await fixture.cleanup() }
})

test('automatic board framing crops saved photos to preview, and manual zoom/reset leave no stale crop', async () => {
  const fixture = camera({ pixels: (width, height) => {
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, light = x >= width * .2 && x < width * .8 && y >= height * .2 && y < height * .8 ? 235 : 45
      pixels[i] = pixels[i + 1] = pixels[i + 2] = light; pixels[i + 3] = 255
    }
    return pixels
  } })
  try {
    await fixture.engine.start()
    assert.equal(await fixture.engine.frameBoard(), true)
    const frame = fixture.frames.at(-1)
    assert.equal(frame.automatic, true)
    await fixture.engine.takePhoto()
    const crop = [1920 * frame.x, 1080 * frame.y, 1920 * frame.width, 1080 * frame.height]
    assert.deepEqual(fixture.images.at(-1)!.draw.slice(0, 4), crop)
    assert.deepEqual(fixture.draws.at(-2)!.slice(0, 4), crop)
    assert.ok(fixture.images.at(-1)!.width < 1600)
    await fixture.engine.setZoom(2)
    assert.equal(fixture.frames.at(-1).automatic, false)
    await fixture.engine.takePhoto()
    assert.deepEqual(fixture.images.at(-1)!.draw.slice(0, 4), [480, 270, 960, 540])
    assert.equal(await fixture.engine.frameBoard(), true)
    fixture.engine.resetFrame()
    assert.equal(fixture.frames.at(-1).width, .5)
    await fixture.engine.stop()
    assert.equal(await fixture.engine.frameBoard(), false)
  } finally { await fixture.cleanup() }
})

test('manual capture sends an unchanged frame and overlapping requests never encode concurrently', async () => {
  const gate = deferred()
  const fixture = camera({ encode: () => gate.promise })
  try {
    await fixture.engine.start()
    const first = fixture.engine.takePhoto()
    await tick()
    const second = fixture.engine.takePhoto(), third = fixture.engine.takePhoto()
    gate.resolve()
    await Promise.all([first, second, third])
    assert.equal(fixture.images.length, 2)
    assert.equal(fixture.peak, 1)
    assert.equal(fixture.skipped, 0)
  } finally { gate.resolve(); await fixture.cleanup() }
})

test('hardware zoom requests apply in order and photos wait for the final constraint without a second digital crop', async () => {
  const gate = deferred(), applied: number[] = []
  const fixture = camera({ hardware: true, apply: async value => { applied.push(value); if (value === 2) await gate.promise } })
  try {
    await fixture.engine.start()
    const first = fixture.engine.setZoom(2), second = fixture.engine.setZoom(3)
    const photo = fixture.engine.takePhoto()
    await tick()
    assert.deepEqual(applied, [2])
    assert.equal(fixture.images.length, 0)
    gate.resolve(); await Promise.all([first, second, photo])
    assert.deepEqual(applied, [2, 3])
    assert.equal(fixture.zooms.at(-1).value, 3)
    assert.equal(fixture.zooms.at(-1).digitalScale, 1)
    assert.deepEqual(fixture.images[0], { width: 1600, height: 900, draw: [0, 0, 1920, 1080, 0, 0, 1600, 900] })
  } finally { gate.resolve(); await fixture.cleanup() }
})

test('stopping during a camera zoom discards queued zoom and snapshot work', async () => {
  const gate = deferred(), applied: number[] = []
  const fixture = camera({ hardware: true, apply: async value => { applied.push(value); await gate.promise } })
  try {
    await fixture.engine.start()
    const zoom = fixture.engine.setZoom(2), nextZoom = fixture.engine.setZoom(3), photo = fixture.engine.takePhoto()
    await tick()
    const count = fixture.zooms.length, stop = fixture.engine.stop()
    gate.resolve(); await Promise.all([zoom, nextZoom, photo, stop])
    assert.deepEqual(applied, [2])
    assert.equal(fixture.images.length, 0)
    assert.equal(fixture.zooms.length, count)
    assert.equal(fixture.stopped, 1)
    assert.equal(fixture.video.srcObject, null)
  } finally { gate.resolve(); await fixture.cleanup() }
})

test('automatic captures still skip unchanged frames while a manual photo always saves', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fixture = camera()
  const settled = () => new Promise(resolve => setImmediate(resolve))
  try {
    await fixture.engine.start()
    t.mock.timers.tick(0); await settled()
    assert.equal(fixture.images.length, 1)
    t.mock.timers.tick(30_000); await settled()
    assert.equal(fixture.skipped, 1)
    assert.equal(fixture.images.length, 1)
    await fixture.engine.takePhoto()
    assert.equal(fixture.images.length, 2)
    await fixture.engine.stop()
    t.mock.timers.tick(60_000); await settled()
    await fixture.engine.takePhoto()
    assert.equal(fixture.images.length, 2)
  } finally { await fixture.cleanup(); t.mock.timers.reset() }
})

test('a rejected camera constraint retains its previous zoom and does not block future snapshots or zoom', async () => {
  const fixture = camera({ hardware: true, apply: async value => { if (value === 2) throw new Error('Zoom unavailable') } })
  try {
    await fixture.engine.start()
    await assert.rejects(fixture.engine.setZoom(2), /Zoom unavailable/)
    assert.equal(fixture.zooms.at(-1).value, 1)
    await fixture.engine.takePhoto()
    assert.equal(fixture.images.length, 1)
    await fixture.engine.setZoom(3)
    assert.equal(fixture.zooms.at(-1).value, 3)
  } finally { await fixture.cleanup() }
})

test('pause drains a photo already being encoded but discards a second queued manual photo', async () => {
  const gate = deferred(), fixture = camera({ encode: () => gate.promise })
  try {
    await fixture.engine.start()
    const photo = fixture.engine.takePhoto()
    await tick()
    const queued = fixture.engine.takePhoto(), stopping = fixture.engine.stop()
    assert.equal(fixture.stopped, 1)
    gate.resolve(); await Promise.all([photo, queued, stopping])
    assert.equal(fixture.images.length, 1)
  } finally { gate.resolve(); await fixture.cleanup() }
})
