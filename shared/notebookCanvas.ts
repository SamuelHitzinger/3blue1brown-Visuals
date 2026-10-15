/** Coordinates use a 1000-unit wide page; no executable SVG or HTML is stored. */
export type CanvasTool = 'select' | 'pen' | 'arrow' | 'block' | 'text'
export type CanvasColor = 'blue' | 'teal' | 'amber' | 'ink'
export interface CanvasMark {
  id: string
  kind: Exclude<CanvasTool, 'select'>
  color: CanvasColor
  points: [number, number][]
  text: string
}
export interface NotebookCanvasData {
  marks: CanvasMark[]
  offsets: Record<string, { x: number; y: number }>
}
export const emptyNotebookCanvas = (): NotebookCanvasData => ({ marks: [], offsets: {} })

export function validNotebookCanvas(value: unknown): value is NotebookCanvasData {
  if (!value || typeof value !== 'object') return false
  const data = value as NotebookCanvasData
  const coordinate = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000
  const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(v)
  if (!Array.isArray(data.marks) || data.marks.length > 300 || new Set(data.marks.map(mark => mark?.id)).size !== data.marks.length) return false
  if (!data.marks.every(mark => mark && id(mark.id) && ['pen', 'arrow', 'block', 'text'].includes(mark.kind) && ['blue', 'teal', 'amber', 'ink'].includes(mark.color)
    && typeof mark.text === 'string' && mark.text.length <= 4000 && Array.isArray(mark.points) && mark.points.length >= 1 && mark.points.length <= 2000
    && mark.points.every(point => Array.isArray(point) && point.length === 2 && point.every(coordinate)))) return false
  if (!data.offsets || typeof data.offsets !== 'object' || Array.isArray(data.offsets) || Object.keys(data.offsets).length > 200) return false
  return Object.entries(data.offsets).every(([key, offset]) => id(key) && offset && coordinate(offset.x) && coordinate(offset.y))
}
