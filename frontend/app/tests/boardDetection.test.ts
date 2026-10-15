import test from 'node:test'
import assert from 'node:assert/strict'
import { detectBoard } from '../src/captureFraming.ts'
import { boardScenes, renderBoardScene } from './fixtures/boardScenes.ts'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { fileURLToPath } from 'node:url'

for (const [name, bounds] of [
  ['teaching-whiteboard', [.038, .037, .842, .826]],
  ['classroom-blackboard', [.396, .10, .995, .417]],
  ['office-whiteboard', null],
] as const) test(`real photograph: ${name}`, async () => {
  const source = await loadImage(fileURLToPath(new URL(`./fixtures/boards/${name}.jpg`, import.meta.url)))
  const canvas = createCanvas(320, Math.round(320 * source.height / source.width)), context = canvas.getContext('2d')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const frame = detectBoard(context.getImageData(0, 0, canvas.width, canvas.height))
  if (!bounds) { assert.equal(frame, null, 'Borderless whiteboard must not crop to one internal diagram'); return }
  assert.ok(frame, `Expected real board: ${name}`)
  assert.ok(frame.x <= bounds[0] && frame.y <= bounds[1])
  assert.ok(frame.x + frame.width >= bounds[2] && frame.y + frame.height >= bounds[3])
  assert.ok(frame.width * frame.height < (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) * 1.4)
})

test('real boards remain enclosed when mirrored and underexposed', async () => {
  for (const [name, bounds] of [
    ['teaching-whiteboard', [.038, .037, .842, .826]],
    ['classroom-blackboard', [.396, .10, .995, .417]],
  ] as const) {
    const source = await loadImage(fileURLToPath(new URL(`./fixtures/boards/${name}.jpg`, import.meta.url)))
    for (const mirror of [false, true]) {
      const canvas = createCanvas(320, Math.round(320 * source.height / source.width)), context = canvas.getContext('2d')
      if (mirror) { context.translate(canvas.width, 0); context.scale(-1, 1) }
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c++) image.data[i + c] *= .7
      const frame = detectBoard(image)
      assert.ok(frame, `${name}, mirrored: ${mirror}`)
      const left = mirror ? 1 - bounds[2] : bounds[0], right = mirror ? 1 - bounds[0] : bounds[2]
      assert.ok(frame.x <= left && frame.y <= bounds[1], `${name}: top/left clipped`)
      assert.ok(frame.x + frame.width >= right && frame.y + frame.height >= bounds[3], `${name}: bottom/right clipped`)
      assert.ok(frame.width * frame.height < (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) * 1.4)
    }
  }
})

for (const scene of boardScenes) test(`frames entire ${scene.name} while removing surrounding room`, () => {
  const image = renderBoardScene(scene), frame = detectBoard(image)
  assert.ok(frame, `No board found: ${scene.name}`)
  const xs = scene.corners.map(p => p[0]), ys = scene.corners.map(p => p[1])
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys)
  assert.ok(frame.x * 320 <= left + 1 && frame.y * 240 <= top + 1, 'Top/left teaching content must remain')
  assert.ok((frame.x + frame.width) * 320 >= right - 1 && (frame.y + frame.height) * 240 >= bottom - 1, 'Bottom/right teaching content must remain')
  assert.ok(frame.width * frame.height * 320 * 240 < (right - left) * (bottom - top) * 1.55, 'Crop must remove meaningful background')
})

test('blank, noisy and striped views keep whole-photo fallback', () => {
  for (const pattern of ['blank', 'noise', 'stripes']) {
    const width = 320, height = 240, data = new Uint8ClampedArray(width * height * 4)
    let seed = 5
    for (let i = 0; i < data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      const value = pattern === 'noise' ? seed >>> 24 : pattern === 'stripes' ? ((i / 4) % width) % 24 < 12 ? 30 : 210 : 160
      data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255
    }
    assert.equal(detectBoard({ width, height, data }), null, pattern)
  }
})

test('thick internal diagrams never discard surrounding board content', () => {
  for (const lineWidth of [2, 5, 8, 10]) {
    const canvas = createCanvas(320, 240), context = canvas.getContext('2d')
    context.fillStyle = '#ddd'; context.fillRect(0, 0, 320, 240)
    context.strokeStyle = '#333'; context.lineWidth = lineWidth
    context.strokeRect(65, 65, 190, 110)
    context.fillStyle = '#333'; context.font = '16px sans-serif'; context.fillText('Keep this explanation', 20, 35)
    assert.equal(detectBoard(context.getImageData(0, 0, 320, 240)), null, `Internal diagram stroke: ${lineWidth}`)
  }
})
