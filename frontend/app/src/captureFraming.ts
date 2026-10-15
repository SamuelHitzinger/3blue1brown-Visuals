export interface CaptureFrame { x: number; y: number; width: number; height: number }
export const fullFrame: CaptureFrame = { x: 0, y: 0, width: 1, height: 1 }
export function zoomFrame(zoom: number, frame: CaptureFrame = fullFrame): CaptureFrame {
  const scale = Number.isFinite(zoom) ? Math.max(1, zoom) : 1
  const width = frame.width / scale, height = frame.height / scale
  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height }
}

/** Camera zoom is centered, so the furthest edge (not just the board's size)
 * limits magnification. Leave additional room for movement and round down. */
export function boardZoom(frame: CaptureFrame, current: number, min: number, max: number, step: number): number {
  const extent = Math.max(1 - 2 * frame.x, 2 * (frame.x + frame.width) - 1,
    1 - 2 * frame.y, 2 * (frame.y + frame.height) - 1)
  const target = Math.max(min, Math.min(max, current * .94 / extent))
  return Math.max(min, Math.min(max, min + Math.floor((target - min) / step + 1e-9) * step))
}

/** Local, bounded line search on a thumbnail. Tilted edges and partial occlusion
 * are allowed; four supported sides are still required before removing content.
 * Returns an enclosing rectangle, not a perspective warp (edge text stays intact). */
export function detectBoard(image: { width: number; height: number; data: Uint8ClampedArray }): CaptureFrame | null {
  const { width: w, height: h, data } = image
  if (w < 40 || h < 40 || w > 640 || h > 640 || data.length !== w * h * 4) return null
  const raw = new Float32Array(w * h), gray = new Float32Array(w * h)
  for (let i = 0; i < raw.length; i++) raw[i] = data[i * 4] * .299 + data[i * 4 + 1] * .587 + data[i * 4 + 2] * .114
  // Suppress sensor noise and thin writing before looking for long boundaries.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    gray[i] = (raw[i - w - 1] + raw[i - w] + raw[i - w + 1] + raw[i - 1] + raw[i] + raw[i + 1] + raw[i + w - 1] + raw[i + w] + raw[i + w + 1]) / 9
  }
  const at = (x: number, y: number) => gray[Math.max(1, Math.min(h - 2, Math.round(y))) * w + Math.max(1, Math.min(w - 2, Math.round(x)))]
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h), strength = new Float32Array(w * h)
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    const i = y * w + x
    gx[i] = gray[i + 2] - gray[i - 2]; gy[i] = gray[i + 2 * w] - gray[i - 2 * w]
    strength[i] = Math.hypot(gx[i], gy[i])
  }
  type Line = { nx: number; ny: number; rho: number; angle: number; score: number; center: number }
  const angles = Array.from({ length: 62 }, (_, index) => (index < 31 ? -30 + index * 2 : 60 + (index - 31) * 2) * Math.PI / 180)
  const cos = angles.map(Math.cos), sin = angles.map(Math.sin)
  const radius = Math.ceil(Math.hypot(w, h) / 2), bins = radius * 2 + 1
  const votes = new Float32Array(angles.length * bins)
  const edges: { x: number; y: number; dx: number; dy: number; weight: number }[] = []
  for (let y = 4; y < h - 4; y++) for (let x = 4; x < w - 4; x++) {
    const i = y * w + x, magnitude = strength[i]
    if (magnitude < 7) continue
    const offset = Math.abs(gx[i]) > Math.abs(gy[i]) ? 1 : w
    if (magnitude <= strength[i - offset] || magnitude < strength[i + offset]) continue
    edges.push({ x, y, dx: gx[i] / magnitude, dy: gy[i] / magnitude, weight: Math.min(3, magnitude / 12) })
    let angle = Math.atan2(gy[i], gx[i]) * 180 / Math.PI
    if (angle < -45) angle += 180
    if (angle >= 135) angle -= 180
    const vertical = angle < 45, base = vertical ? 0 : 31
    const bin = Math.round((angle - (vertical ? -30 : 60)) / 2)
    for (let a = Math.max(0, bin - 4); a <= Math.min(30, bin + 4); a++) {
      const index = base + a, rho = Math.round((x * cos[index] + y * sin[index]) / 2) + radius
      votes[index * bins + rho] += Math.min(3, magnitude / 12)
    }
  }
  const lines = (start: number) => {
    const candidates: Line[] = []
    for (let a = start; a < start + 31; a++) for (let r = 1; r < bins - 1; r++) {
      const index = a * bins + r, score = votes[index]
      if (score < 14 || score < votes[index - 1] || score < votes[index + 1]) continue
      const rho = (r - radius) * 2, nx = cos[a], ny = sin[a]
      const center = start === 0 ? (rho - h / 2 * ny) / nx : (rho - w / 2 * nx) / ny
      candidates.push({ nx, ny, rho, angle: angles[a], score, center })
    }
    candidates.sort((a, b) => b.score - a.score)
    const chosen: Line[] = []
    for (const line of candidates) {
      if (chosen.some(other => Math.abs(other.center - line.center) < 7 && Math.abs(other.angle - line.angle) < .15)) continue
      // Refine the coarse Hough bin against its actual edge pixels. Otherwise
      // a 2-degree bin error can put a thin frame several pixels off the border.
      let weight = 0, st = 0, sv = 0, stt = 0, stv = 0
      for (const edge of edges) {
        if (Math.abs(edge.x * line.nx + edge.y * line.ny - line.rho) > 3 || Math.abs(edge.dx * line.nx + edge.dy * line.ny) < .94) continue
        const t = start === 0 ? edge.y : edge.x, v = start === 0 ? edge.x : edge.y, k = edge.weight
        weight += k; st += k * t; sv += k * v; stt += k * t * t; stv += k * t * v
      }
      const denominator = stt * weight - st * st
      if (weight > 10 && denominator > 1) {
        const slope = (stv * weight - st * sv) / denominator, intercept = (sv - slope * st) / weight
        const normal = 1 / Math.sqrt(1 + slope * slope)
        line.nx = start === 0 ? normal : -slope * normal; line.ny = start === 0 ? -slope * normal : normal
        line.rho = intercept * normal; line.angle = Math.atan2(line.ny, line.nx)
        line.center = start === 0 ? intercept + slope * h / 2 : intercept + slope * w / 2
      }
      chosen.push(line)
      if (chosen.length === 12) break
    }
    return chosen.sort((a, b) => a.center - b.center)
  }
  const vertical = lines(0), horizontal = lines(31)
  type Point = { x: number; y: number }
  const intersection = (a: Line, b: Line): Point => {
    const det = a.nx * b.ny - b.nx * a.ny
    return { x: (a.rho * b.ny - b.rho * a.ny) / det, y: (a.nx * b.rho - b.nx * a.rho) / det }
  }
  const pixel = (px: number, py: number) => (Math.max(0, Math.min(h - 1, Math.round(py))) * w + Math.max(0, Math.min(w - 1, Math.round(px)))) * 4
  const border = (a: Point, b: Point) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length
    const positive = [0, 0, 0], negative = [0, 0, 0]
    const farPositive = [0, 0, 0], farNegative = [0, 0, 0]
    let ridge = 0, interior = 0
    for (let i = 0; i < 32; i++) {
      const t = .04 + .92 * (i + .5) / 32, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
      const inside = at(x + nx * 5, y + ny * 5), outside = at(x - nx * 5, y - ny * 5)
      interior += inside
      const inner = pixel(x + nx * 5, y + ny * 5), outer = pixel(x - nx * 5, y - ny * 5)
      const farInner = pixel(x + nx * 12, y + ny * 12), farOuter = pixel(x - nx * 12, y - ny * 12)
      let contrast = 0
      for (let channel = 0; channel < 3; channel++) {
        const delta = data[inner + channel] - data[outer + channel]
        contrast = Math.max(contrast, Math.abs(delta))
        if (delta > 7) positive[channel]++
        else if (delta < -7) negative[channel]++
        const farDelta = data[farInner + channel] - data[farOuter + channel]
        if (farDelta > 7) farPositive[channel]++
        else if (farDelta < -7) farNegative[channel]++
      }
      if (contrast <= 7 && Math.abs(at(x, y) - (inside + outside) / 2) > 16) ridge++
    }
    const step = Math.max(...positive, ...negative) / 32
    return { support: step + ridge / 32, step: Math.max(...farPositive, ...farNegative) / 32, interior: interior / 32 }
  }
  let best: CaptureFrame | null = null, bestScore = 0
  for (let a = 0; a < vertical.length; a++) for (let b = a + 1; b < vertical.length; b++) {
    if (vertical[b].center - vertical[a].center < w * .14 || Math.abs(vertical[a].angle - vertical[b].angle) > .55) continue
    for (let c = 0; c < horizontal.length; c++) for (let d = c + 1; d < horizontal.length; d++) {
      if (horizontal[d].center - horizontal[c].center < h * .09 || Math.abs(horizontal[c].angle - horizontal[d].angle) > .45) continue
      const corners = [intersection(vertical[a], horizontal[c]), intersection(vertical[b], horizontal[c]), intersection(vertical[b], horizontal[d]), intersection(vertical[a], horizontal[d])]
      if (corners.some(p => p.x < 1 || p.x > w - 1 || p.y < 1 || p.y > h - 1 || !Number.isFinite(p.x + p.y))) continue
      const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x))
      const top = Math.min(...corners.map(p => p.y)), bottom = Math.max(...corners.map(p => p.y))
      const area = (right - left) * (bottom - top) / (w * h), aspect = (right - left) / (bottom - top)
      if (area < .025 || area > .94 || aspect < .8 || aspect > 6 || area <= bestScore) continue
      const borders: ReturnType<typeof border>[] = []
      for (let i = 0; i < 4; i++) {
        const edge = border(corners[i], corners[(i + 1) % 4])
        if (edge.support < .59) break
        borders.push(edge)
      }
      if (borders.length !== 4) continue
      // A drawn box on a board has a thin ridge but no persistent change of
      // surface color beyond its ink. Sample farther out as well so thick
      // diagram strokes cannot crop away surrounding teaching content.
      if (borders.filter(edge => edge.step >= .6).length < 2) continue
      // Room corners can also form four long lines. The area just inside each
      // side should belong to the same teaching surface, allowing broad shadows.
      if (Math.max(...borders.map(edge => edge.interior)) - Math.min(...borders.map(edge => edge.interior)) > 75) continue
      const average = borders.reduce((sum, edge) => sum + edge.support, 0) / 4
      if (average < .78) continue
      // Large room rectangles can borrow short fragments of unrelated edges.
      // Reward complete boundaries more than extra area around a smaller board.
      const confidence = average * Math.min(...borders.map(edge => edge.support))
      const score = area * confidence * confidence
      if (score <= bestScore) continue
      bestScore = score
      const x = Math.max(0, left - w * .025), y = Math.max(0, top - h * .025)
      best = { x: x / w, y: y / h, width: (Math.min(w, right + w * .025) - x) / w, height: (Math.min(h, bottom + h * .025) - y) / h }
    }
  }
  return best
}
