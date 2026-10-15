import { createCanvas } from '@napi-rs/canvas'

export type Point = [number, number]
export interface BoardScene {
  name: string
  corners: Point[]
  wall: number
  board: number
  shadow?: boolean
  occluded?: boolean
  clutter?: boolean
}

export const boardScenes: BoardScene[] = [
  { name: 'angled whiteboard', corners: [[42, 51], [273, 27], [257, 191], [55, 211]], wall: 110, board: 230 },
  { name: 'perspective blackboard', corners: [[35, 50], [259, 72], [282, 207], [52, 180]], wall: 180, board: 42 },
  { name: 'tilted projection', corners: [[56, 32], [289, 75], [260, 204], [32, 158]], wall: 60, board: 210 },
  { name: 'faint whiteboard on pale wall', corners: [[35, 40], [281, 40], [281, 195], [35, 195]], wall: 205, board: 222 },
  { name: 'faint angled board', corners: [[45, 58], [270, 35], [280, 185], [58, 202]], wall: 195, board: 215 },
  { name: 'unevenly lit whiteboard', corners: [[35, 40], [281, 50], [275, 200], [40, 190]], wall: 130, board: 220, shadow: true },
  { name: 'small distant presentation', corners: [[115, 91], [197, 85], [202, 143], [118, 149]], wall: 80, board: 220 },
  { name: 'wide chalkboard', corners: [[16, 87], [303, 75], [298, 150], [20, 164]], wall: 160, board: 35 },
  { name: 'partly obscured board', corners: [[35, 40], [281, 40], [281, 195], [35, 195]], wall: 120, board: 225, occluded: true },
  { name: 'writing and classroom clutter', corners: [[42, 51], [273, 27], [257, 191], [55, 211]], wall: 150, board: 228, clutter: true },
]

export function renderBoardScene(scene: BoardScene) {
  const canvas = createCanvas(320, 240), ctx = canvas.getContext('2d')
  ctx.fillStyle = `rgb(${scene.wall},${scene.wall},${scene.wall})`; ctx.fillRect(0, 0, 320, 240)
  if (scene.clutter) {
    ctx.fillStyle = '#777'; ctx.fillRect(5, 12, 22, 130)
    ctx.fillStyle = '#aaa'; ctx.fillRect(285, 8, 28, 215)
    ctx.strokeStyle = '#555'
    for (let y = 20; y < 215; y += 14) { ctx.beginPath(); ctx.moveTo(285, y); ctx.lineTo(315, y); ctx.stroke() }
  }
  ctx.beginPath(); scene.corners.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath()
  ctx.save(); ctx.clip()
  const shade = ctx.createLinearGradient(0, 0, 320, 200)
  shade.addColorStop(0, `rgb(${scene.board},${scene.board},${scene.board})`)
  const dark = scene.board - (scene.shadow ? 90 : 4)
  shade.addColorStop(1, `rgb(${dark},${dark},${dark})`)
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 320, 240)
  const xs = scene.corners.map(p => p[0]), ys = scene.corners.map(p => p[1])
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys)
  ctx.strokeStyle = scene.board < 100 ? '#bbb' : '#525252'; ctx.lineWidth = 1
  // Broken strokes, equations and a diagram create internal edges that must
  // not be selected as a smaller board. Keep labels near all four corners.
  for (let y = top + 23; y < bottom - 12; y += 19) {
    for (let x = left + 18; x < right - 15; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 5); ctx.lineTo(x + 9, y + 2); ctx.stroke()
    }
  }
  ctx.restore()
  if (scene.occluded) { ctx.fillStyle = '#666'; ctx.fillRect(247, 151, 55, 89) }
  // Deterministic sensor noise, applied after drawing (not a clean solid box).
  const image = ctx.getImageData(0, 0, 320, 240)
  let seed = 1234
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const noise = ((seed >>> 24) / 255 - .5) * 5
    for (let c = 0; c < 3; c++) image.data[i + c] += noise
  }
  return image
}
