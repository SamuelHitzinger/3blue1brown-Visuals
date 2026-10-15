// Offline CPU benchmark; does not include camera, upload, or note generation.
// node scripts/benchmark-capture-framing.ts [path-to-baseline-module.ts]
import { createCanvas, loadImage, ImageData } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cpus } from 'node:os'
import { detectBoard } from '../frontend/app/src/captureFraming.ts'
import { boardScenes, renderBoardScene } from '../frontend/app/tests/fixtures/boardScenes.ts'

const cases = boardScenes.map(scene => ({ name: scene.name, image: renderBoardScene(scene) }))
for (const name of ['teaching-whiteboard', 'classroom-blackboard', 'office-whiteboard']) {
  const source = await loadImage(fileURLToPath(new URL(`../frontend/app/tests/fixtures/boards/${name}.jpg`, import.meta.url)))
  const canvas = createCanvas(320, Math.round(320 * source.height / source.width)), context = canvas.getContext('2d')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  cases.push({ name, image: context.getImageData(0, 0, canvas.width, canvas.height) })
}
for (const name of ['blank', 'sensor noise', 'striped wall']) {
  const image = new ImageData(320, 240)
  let seed = 5
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const value = name === 'sensor noise' ? seed >>> 24 : name === 'striped wall' ? ((i / 4) % 320) % 24 < 12 ? 30 : 210 : 160
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255
  }
  cases.push({ name, image })
}
const detectors = [{ name: 'current', detect: detectBoard }]
if (process.argv[2]) detectors.unshift({ name: 'baseline', detect: (await import(pathToFileURL(resolve(process.argv[2])).href)).detectBoard })
const results = []
for (const { name, detect } of detectors) {
  const coldStart = performance.now(); detect(cases[0].image)
  const coldFirstMs = +(performance.now() - coldStart).toFixed(2)
  // Warm JIT equally; exclude image IO and rasterization from the timed section.
  for (let round = 0; round < 10; round++) for (const scene of cases) detect(scene.image)
  const durations: number[] = [], perCase = []
  for (const scene of cases) {
    const samples: number[] = []
    for (let round = 0; round < 60; round++) {
      const start = performance.now(); detect(scene.image); samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b); durations.push(...samples)
    perCase.push({ name: scene.name, medianMs: +samples[30].toFixed(2), p95Ms: +samples[57].toFixed(2) })
  }
  durations.sort((a, b) => a - b)
  results.push({ name, coldFirstMs, samples: durations.length, medianMs: +durations[Math.floor(durations.length * .5)].toFixed(2),
    p95Ms: +durations[Math.floor(durations.length * .95)].toFixed(2), perCase })
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, results }, null, 2))

// Visual evidence from the exact benchmark pixels. Green = returned crop;
// orange = whole-photo fallback. Keep this generated artifact out of the bundle.
const gallery = createCanvas(3 * 340, Math.ceil(cases.length / 3) * 280), ctx = gallery.getContext('2d')
ctx.fillStyle = '#17202b'; ctx.fillRect(0, 0, gallery.width, gallery.height)
cases.forEach((scene, index) => {
  const x = index % 3 * 340 + 10, y = Math.floor(index / 3) * 280 + 30
  ctx.putImageData(new ImageData(new Uint8ClampedArray(scene.image.data), scene.image.width, scene.image.height), x, y)
  const frame = detectBoard(scene.image)
  ctx.lineWidth = 2; ctx.strokeStyle = frame ? '#00e896' : '#ffbd59'
  const f = frame ?? { x: 0, y: 0, width: 1, height: 1 }
  ctx.strokeRect(x + f.x * scene.image.width + 1, y + f.y * scene.image.height + 1, f.width * scene.image.width - 2, f.height * scene.image.height - 2)
  ctx.fillStyle = '#ffffff'; ctx.font = '14px sans-serif'; ctx.fillText(scene.name, x, y - 10)
})
mkdirSync('.tmp', { recursive: true })
writeFileSync('.tmp/capture-framing-gallery.png', gallery.toBuffer('image/png'))
