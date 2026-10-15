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

/** Conservative rectangle proposal, not semantic recognition. Runs on a small local frame.
 * Require four continuous contrasting borders; leave uncertain views unchanged. */
export function detectBoard(image: { width: number; height: number; data: Uint8ClampedArray }): CaptureFrame | null {
  const { width: w, height: h, data } = image
  if (w < 40 || h < 40 || data.length !== w * h * 4) return null
  const gray = new Float32Array(w * h), rows = new Float32Array(h), cols = new Float32Array(w)
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * .299 + data[i * 4 + 1] * .587 + data[i * 4 + 2] * .114
  const at = (x: number, y: number) => gray[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))]
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    cols[x] += Math.min(100, Math.abs(at(x + 2, y) - at(x - 2, y))) / h
    rows[y] += Math.min(100, Math.abs(at(x, y + 2) - at(x, y - 2))) / w
  }
  const peaks = (values: Float32Array) => {
    const sorted = Array.from(values, (score, index) => ({ score, index })).filter(p => p.score > 6).sort((a, b) => b.score - a.score)
    const result: number[] = []
    for (const p of sorted) { if (result.every(v => Math.abs(v - p.index) > 6)) result.push(p.index); if (result.length === 10) break }
    return result.sort((a, b) => a - b)
  }
  const xs = peaks(cols), ys = peaks(rows)
  const border = (x1: number, y1: number, x2: number, y2: number, horizontal: boolean) => {
    let hits = 0, contrast = 0
    for (let i = 0; i < 40; i++) {
      const t = (i + .5) / 40, x = Math.round(x1 + (x2 - x1) * t), y = Math.round(y1 + (y2 - y1) * t)
      const delta = horizontal ? Math.abs(at(x, y - 4) - at(x, y + 4)) : Math.abs(at(x - 4, y) - at(x + 4, y))
      if (delta > 22) hits++
      contrast += delta
    }
    return { support: hits / 40, contrast: contrast / 40 }
  }
  let best: CaptureFrame | null = null, bestScore = 0
  for (let a = 0; a < xs.length; a++) for (let b = a + 1; b < xs.length; b++)
    for (let c = 0; c < ys.length; c++) for (let d = c + 1; d < ys.length; d++) {
      const left = xs[a], right = xs[b], top = ys[c], bottom = ys[d]
      const width = right - left, height = bottom - top, area = width * height / (w * h), aspect = width / height
      if (area < .04 || area > .88 || aspect < 1.05 || aspect > 3.8 || height < h * .1) continue
      const borders = [border(left, top, right, top, true), border(left, bottom, right, bottom, true), border(left, top, left, bottom, false), border(right, top, right, bottom, false)]
      if (borders.some(edge => edge.support < .75 || edge.contrast < 25)) continue
      const score = area * borders.reduce((sum, edge) => sum + edge.support, 0)
      if (score <= bestScore) continue
      bestScore = score
      // Retain the border and a margin so edge text is not clipped.
      const x = Math.max(0, left - w * .025), y = Math.max(0, top - h * .025)
      best = { x: x / w, y: y / h, width: (Math.min(w, right + w * .025) - x) / w, height: (Math.min(h, bottom + h * .025) - y) / h }
    }
  return best
}
