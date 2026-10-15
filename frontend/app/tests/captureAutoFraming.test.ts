import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { CaptureEngine } from '../src/captureEngine.ts'
import type { CapturedMedia } from '../src/captureEngine.ts'

// Only browser/camera boundaries are substituted. Detection, pixel cropping,
// JPEG encoding and the blob handed to the upload queue use real code/pixels.
function cameraFixture(options: { cameraZoom?: boolean; dark?: boolean; rejectZoom?: boolean; holdZoom?: boolean; moveAfterSnapshot?: boolean; delayedFrames?: boolean } = {}) {
  const original = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const scene = createCanvas(640, 480), video = createCanvas(640, 480)
  let board: { x: number; y: number; width: number; height: number } | null = { x: 160, y: 150, width: 320, height: 180 }
  let zoom = 1
  let detectionFailure: 'context' | 'read' | null = null
  let announceZoom!: () => void, releaseZoom!: () => void, canvases = 0
  const zoomStarted = new Promise<void>(resolve => { announceZoom = resolve })
  const zoomGate = new Promise<void>(resolve => { releaseZoom = resolve })
  const zoomRequests: number[] = [], photos: CapturedMedia[] = [], paused: string[] = []
  const render = () => {
    const context = scene.getContext('2d')
    context.fillStyle = options.dark ? '#c8c8c8' : '#282828'; context.fillRect(0, 0, 640, 480)
    if (board) {
      const { x, y, width, height } = board
      context.fillStyle = options.dark ? '#202020' : '#eeeeee'; context.fillRect(x, y, width, height)
      context.fillStyle = '#ff0000'; context.fillRect(x + 8, y + 8, 12, 12)
      context.fillStyle = '#0000ff'; context.fillRect(x + width - 20, y + height - 20, 12, 12)
    }
    video.getContext('2d').drawImage(scene, 320 - 320 / zoom, 240 - 240 / zoom, 640 / zoom, 480 / zoom, 0, 0, 640, 480)
  }
  render()
  Object.assign(video, { videoWidth: 640, videoHeight: 480, readyState: 4, srcObject: null, play: async () => {} })
  if (options.delayedFrames) Object.assign(video, {
    requestVideoFrameCallback(callback: () => void) { return setTimeout(() => { render(); callback() }, 50) },
    cancelVideoFrameCallback(id: ReturnType<typeof setTimeout>) { clearTimeout(id) },
  })
  const track = Object.assign(new EventTarget(), {
    stop() {},
    getCapabilities: () => options.cameraZoom ? { zoom: { min: 1, max: 4, step: .1 } } : {},
    getSettings: () => ({ zoom }),
    async applyConstraints(constraints: { advanced: { zoom: number }[] }) {
      const next = constraints.advanced[0].zoom
      zoomRequests.push(next)
      announceZoom()
      if (options.holdZoom) await zoomGate
      if (options.rejectZoom) throw new Error('Zoom unavailable')
      zoom = next
      if (!options.delayedFrames) render()
    },
  })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const replacements = {
    window: { isSecureContext: true },
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    document: { createElement(name: string) {
      assert.equal(name, 'canvas')
      if (++canvases === 2 && options.moveAfterSnapshot) { board = null; render() }
      const canvas = createCanvas(1, 1)
      const getContext = canvas.getContext.bind(canvas)
      Object.assign(canvas, { getContext(type: '2d', settings?: { willReadFrequently?: boolean }) {
        if (detectionFailure && settings?.willReadFrequently && canvas.width > 128) {
          if (detectionFailure === 'context') return null
          const context = getContext(type)
          return { drawImage: context.drawImage.bind(context), getImageData() { throw new Error('Frame analysis unavailable') } }
        }
        return getContext(type)
      } })
      return Object.assign(canvas, { toBlob(callback: (blob: Blob) => void) { callback(new Blob([canvas.toBuffer('image/jpeg')], { type: 'image/jpeg' })) } })
    } },
  }
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const engine = new CaptureEngine({ video: video as unknown as HTMLVideoElement, audio: false, photo: true, photoIntervalMs: 60_000,
    canCapture: () => true, onMedia: async media => { photos.push(media) }, onSkipped() {}, onPaused(reason) { paused.push(reason) } })
  return { engine, photos, paused, zoomRequests, zoomStarted, releaseZoom, get zoom() { return zoom },
    failDetection(failure: 'context' | 'read') { detectionFailure = failure },
    move(next: typeof board) { board = next; render() },
    async close() {
      releaseZoom()
      await engine.stop()
      for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
    },
  }
}

async function inspect(media: CapturedMedia) {
  assert.equal(media.kind, 'photo'); assert.equal(media.blob.type, 'image/jpeg')
  const image = await loadImage(Buffer.from(await media.blob.arrayBuffer()))
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, image.width, image.height).data
  let red = 0, blue = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 160 && pixels[i + 1] < 90 && pixels[i + 2] < 90) red++
    if (pixels[i + 2] > 160 && pixels[i + 1] < 90 && pixels[i] < 90) blue++
  }
  return { width: image.width, height: image.height, red, blue }
}

for (const dark of [false, true]) test(`automatically crops ${dark ? 'blackboard' : 'whiteboard/slide'} before notes handoff without camera zoom`, async () => {
  const fixture = cameraFixture({ dark })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.width > 320 && photo.width < 380, `Expected board crop, got ${photo.width}`)
    assert.ok(photo.height > 180 && photo.height < 240)
    assert.ok(photo.red > 50 && photo.blue > 50, 'Both edge labels must survive the crop')
    assert.deepEqual(fixture.paused, [])
  } finally { await fixture.close() }
})

for (const cameraZoom of [false, true]) test(`framing failure sends whole photo and clears the previous crop (camera zoom: ${cameraZoom})`, async () => {
  const fixture = cameraFixture({ cameraZoom })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    assert.ok((await inspect(fixture.photos[0])).width < 640)
    fixture.failDetection(cameraZoom ? 'read' : 'context')
    await fixture.engine.takePhoto()
    assert.equal(fixture.photos.length, 2, 'Framing failure must not stop photo handoff')
    const fallback = await inspect(fixture.photos[1])
    assert.deepEqual([fallback.width, fallback.height], [640, 480])
    assert.ok(fallback.red > 50 && fallback.blue > 50, 'Whole image must retain both edge labels')
    assert.equal(fixture.zoom, 1)
    assert.deepEqual(fixture.paused, [])
  } finally { await fixture.close() }
})

test('crop and uploaded JPEG use the same frozen frame even if the camera moves during analysis', async () => {
  const fixture = cameraFixture({ moveAfterSnapshot: true })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.width < 380 && photo.red > 50 && photo.blue > 50)
  } finally { await fixture.close() }
})

test('manual zoom during automatic adjustment wins and queued shutter uses the final view', async () => {
  const fixture = cameraFixture({ cameraZoom: true, holdZoom: true })
  try {
    await fixture.engine.start()
    const automatic = fixture.engine.takePhoto()
    await fixture.zoomStarted
    const manual = fixture.engine.setZoom(1)
    const shutter = fixture.engine.takePhoto()
    fixture.releaseZoom()
    await Promise.all([automatic, manual, shutter])
    assert.equal(fixture.zoom, 1)
    assert.equal(fixture.photos.length, 1, 'Cancelled automatic work must not upload a stale crop')
    const photo = await inspect(fixture.photos[0])
    assert.deepEqual([photo.width, photo.height], [640, 480])
    assert.ok(photo.red > 50 && photo.blue > 50)
  } finally { await fixture.close() }
})

test('stop during automatic zoom prevents late photo upload', async () => {
  const fixture = cameraFixture({ cameraZoom: true, holdZoom: true })
  try {
    await fixture.engine.start()
    const shutter = fixture.engine.takePhoto()
    await fixture.zoomStarted
    const stopping = fixture.engine.stop()
    fixture.releaseZoom()
    await Promise.all([shutter, stopping])
    assert.equal(fixture.photos.length, 0)
  } finally { await fixture.close() }
})

test('delayed camera frames settle before zoomed capture and wide fallback', async () => {
  const fixture = cameraFixture({ cameraZoom: true, delayedFrames: true })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    const zoomed = await inspect(fixture.photos[0])
    assert.ok(zoomed.width > 500, 'Zoomed photo must use new camera pixels, not the previous wide frame')
    fixture.move({ x: 30, y: 80, width: 320, height: 180 })
    await fixture.engine.takePhoto()
    const moved = await inspect(fixture.photos[1])
    assert.ok(moved.red > 50 && moved.blue > 50, 'Reacquisition must wait for the fresh wide frame')
  } finally { await fixture.close() }
})

for (const offCenter of [false, true]) test(`camera zoom fills view without losing board edges (off center: ${offCenter})`, async () => {
  const fixture = cameraFixture({ cameraZoom: true })
  try {
    if (offCenter) fixture.move({ x: 85, y: 130, width: 320, height: 180 })
    await fixture.engine.start(); await fixture.engine.takePhoto()
    assert.ok(fixture.zoom > 1, 'Camera should automatically zoom in')
    assert.ok(fixture.zoom <= (offCenter ? 1.2 : 1.8), 'Off-center edges constrain safe zoom')
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.red > 50 && photo.blue > 50)
    assert.ok(photo.width < 640, 'Residual background should be cropped after hardware zoom')
  } finally { await fixture.close() }
})

test('a small distant board is enlarged and cropped with both edge labels intact', async () => {
  const fixture = cameraFixture({ cameraZoom: true })
  try {
    fixture.move({ x: 220, y: 180, width: 200, height: 120 })
    await fixture.engine.start(); await fixture.engine.takePhoto()
    assert.ok(fixture.zoom > 2, 'Distant board should use available camera detail')
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.red > 50 && photo.blue > 50)
  } finally { await fixture.close() }
})

test('board near image edge limits automatic zoom instead of cutting off writing', async () => {
  const fixture = cameraFixture({ cameraZoom: true })
  try {
    fixture.move({ x: 30, y: 100, width: 320, height: 180 })
    await fixture.engine.start(); await fixture.engine.takePhoto()
    assert.equal(fixture.zoom, 1)
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.width < 400 && photo.red > 50 && photo.blue > 50)
  } finally { await fixture.close() }
})

test('reacquires moved board and falls back to full wide image when target disappears', async () => {
  const fixture = cameraFixture({ cameraZoom: true })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    fixture.move({ x: 30, y: 80, width: 320, height: 180 })
    await fixture.engine.takePhoto()
    const moved = await inspect(fixture.photos[1])
    assert.ok(moved.width < 400, 'Old centered crop must not survive camera movement')
    assert.ok(moved.red > 50 && moved.blue > 50)
    fixture.move(null); await fixture.engine.takePhoto()
    const missing = await inspect(fixture.photos[2])
    assert.equal(fixture.zoom, 1)
    assert.deepEqual([missing.width, missing.height], [640, 480])
  } finally { await fixture.close() }
})

test('unsupported camera constraints still deliver automatically cropped photo', async () => {
  const fixture = cameraFixture({ cameraZoom: true, rejectZoom: true })
  try {
    await fixture.engine.start(); await fixture.engine.takePhoto()
    assert.ok(fixture.zoomRequests.length > 0)
    const photo = await inspect(fixture.photos[0])
    assert.ok(photo.width < 380 && photo.red > 50 && photo.blue > 50)
    assert.deepEqual(fixture.paused, [])
  } finally { await fixture.close() }
})

test('manual zoom overrides automatic framing; frame board enables automatic capture again', async () => {
  const fixture = cameraFixture()
  try {
    await fixture.engine.start(); await fixture.engine.setZoom(2); await fixture.engine.takePhoto()
    const manual = await inspect(fixture.photos[0])
    assert.deepEqual([manual.width, manual.height], [320, 240])
    await fixture.engine.frameBoard(); await fixture.engine.takePhoto()
    const automatic = await inspect(fixture.photos.at(-1)!)
    assert.ok(automatic.width > 320 && automatic.width < 380)
    fixture.engine.resetFrame(); await fixture.engine.takePhoto()
    const reset = await inspect(fixture.photos.at(-1)!)
    assert.deepEqual([reset.width, reset.height], [640, 480])
  } finally { await fixture.close() }
})
