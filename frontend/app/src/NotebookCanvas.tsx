import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { emptyNotebookCanvas, validNotebookCanvas } from '../../../shared/notebookCanvas'
import type { CanvasColor, CanvasMark, CanvasTool, NotebookCanvasData } from '../../../shared/notebookCanvas'
import { MousePointer2, Pencil, MoveUpRight, Square, Type, Grip, Undo2, Trash2 } from 'lucide-react'

const colors: Record<CanvasColor, string> = { blue: '#28628c', teal: '#23685d', amber: '#a66a16', ink: '#323a36' }
const toolOptions = [{ key: 'select', name: 'Select', Icon: MousePointer2 }, { key: 'pen', name: 'Draw', Icon: Pencil }, { key: 'arrow', name: 'Arrow', Icon: MoveUpRight }, { key: 'block', name: 'Block', Icon: Square }, { key: 'text', name: 'Text', Icon: Type }] as const
export function NotebookTools({ tool, setTool, color, setColor }: { tool: CanvasTool; setTool: (tool: CanvasTool) => void; color: CanvasColor; setColor: (color: CanvasColor) => void }) {
  return <div className="notebook-tools" role="toolbar" aria-label="Notebook tools">
    <div className="notebook-tool-buttons">{toolOptions.map(({ key, name, Icon }) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => setTool(key)} title={name}><Icon size={16}/>{name}</button>)}</div>
    <div className="notebook-colors">{(Object.keys(colors) as CanvasColor[]).map(value => <button key={value} type="button" aria-label={`${value} ink`} aria-pressed={color === value} style={{ background: colors[value] }} onClick={() => setColor(value)}/>)}</div>
    <span className="notebook-tool-hint">Double-click to write · drag grips to move</span>
  </div>
}

type CanvasContextValue = { data: NotebookCanvasData; scale: number; width: number; tool: CanvasTool; change: (data: NotebookCanvasData, before?: NotebookCanvasData) => void; preview: (data: NotebookCanvasData) => void; element: HTMLDivElement | null; begin: () => void; cancel: (data: NotebookCanvasData) => void }
const CanvasContext = createContext<CanvasContextValue | null>(null)

function readDraft(key: string): NotebookCanvasData | null {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return validNotebookCanvas(value) ? value : null } catch { return null }
}

export default function NotebookCanvas({ lectureId, area, value, save, tool, setTool, color, children }: {
  lectureId: string; area: string; value?: NotebookCanvasData; save: (data: NotebookCanvasData) => Promise<void>
  tool: CanvasTool; setTool: (tool: CanvasTool) => void; color: CanvasColor; children: ReactNode
}) {
  const draftKey = `aha-canvas-${lectureId}-${area}`
  const [data, setData] = useState(() => readDraft(draftKey) ?? value ?? emptyNotebookCanvas())
  const interacting = useRef(false), committed = useRef(data)
  const current = useRef(data), pending = useRef(readDraft(draftKey) !== null), saving = useRef(false), mounted = useRef(true)
  const saveRef = useRef(save); saveRef.current = save
  const [status, setStatus] = useState(pending.current ? 'Unsaved drawing' : '')
  const [saveError, setSaveError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [history, setHistory] = useState<NotebookCanvasData[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1000, height: 400 })
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({})
  const marker = useId().replace(/:/g, '')
  const scale = size.width / 1000
  const gesture = useRef<{ start: [number, number]; original: NotebookCanvasData; mark: CanvasMark; moving: boolean } | null>(null)
  const preview = (next: NotebookCanvasData) => { current.current = next; setData(next) }
  const flush = async () => {
    if (saving.current || !pending.current) return
    saving.current = true
    if (mounted.current) { setStatus('Saving…'); setSaveError(false) }
    try {
      while (pending.current) {
        const next = committed.current
        await saveRef.current(next)
        if (committed.current === next) {
          pending.current = false
          try { localStorage.removeItem(draftKey) } catch { /* Server copy is saved. */ }
        }
      }
      if (mounted.current) setStatus('Saved')
    } catch {
      if (mounted.current) { setStatus('Drawing not saved. Retry'); setSaveError(true) }
    } finally { saving.current = false }
  }
  const change = (next: NotebookCanvasData, before = current.current) => {
    setHistory(previous => [...previous.slice(-19), before])
    interacting.current = false; committed.current = next; preview(next); pending.current = true; setSaveError(false); setStatus('Unsaved drawing')
    try { localStorage.setItem(draftKey, JSON.stringify(next)) } catch { /* Keep draft in memory until the server saves it. */ }
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!pending.current && !interacting.current) { const next = value ?? emptyNotebookCanvas(); current.current = next; committed.current = next; setData(next) }
  }, [value])
  useEffect(() => { if (!pending.current) return; const timer = setTimeout(() => void flush(), 450); return () => clearTimeout(timer) }, [data])
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth || 1000, height: element.clientHeight }))
    observer.observe(element); return () => observer.disconnect()
  }, [])
  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = ref.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(1000, (event.clientX - rect.left) / scale)), Math.max(0, (event.clientY - rect.top) / scale)]
  }
  const addText = (at: [number, number]) => {
    if (current.current.marks.length >= 300) return
    const mark: CanvasMark = { id: crypto.randomUUID(), kind: 'text', color, points: [[Math.min(680, at[0]), at[1]]], text: '' }
    change({ ...current.current, marks: [...current.current.marks, mark] }); setSelected(mark.id); setEditing(mark.id); setTool('select')
  }
  const start = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || tool === 'select') return
    event.preventDefault()
    const at = point(event)
    if (tool === 'text') { addText(at); return }
    if (current.current.marks.length >= 300) return
    const mark: CanvasMark = { id: crypto.randomUUID(), kind: tool, color, points: [at, at], text: '' }
    interacting.current = true; gesture.current = { start: at, original: current.current, mark, moving: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    preview({ ...current.current, marks: [...current.current.marks, mark] }); setSelected(mark.id)
  }
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current
    if (!active) return
    const at = point(event)
    const points: [number, number][] = active.moving
      ? active.mark.points.map(([x, y]) => [x + at[0] - active.start[0], y + at[1] - active.start[1]])
      : active.mark.kind === 'pen' ? [...current.current.marks.find(mark => mark.id === active.mark.id)!.points.slice(0, 1999), at] : [active.start, at]
    preview({ ...current.current, marks: current.current.marks.map(mark => mark.id === active.mark.id ? { ...mark, points } : mark) })
  }
  const finish = () => {
    const active = gesture.current
    if (!active) return
    gesture.current = null; change(current.current, active.original)
  }
  const remove = () => { if (selected) { change({ ...current.current, marks: current.current.marks.filter(mark => mark.id !== selected) }); setSelected(null); setEditing(null) } }
  const selectedMark = data.marks.find(mark => mark.id === selected)
  const editingMark = data.marks.find(mark => mark.id === editing)
  return <CanvasContext.Provider value={{ data, scale, width: size.width, tool, change, preview, element: ref.current, begin: () => { interacting.current = true }, cancel: next => { interacting.current = false; preview(next) } }}>
    <div className={`notebook-canvas tool-${tool}`} ref={ref} data-canvas-area={area} style={{ minHeight: Math.max(160, ...data.marks.map(mark => (Math.max(...mark.points.map(p => p[1])) + (labelHeights[mark.id] ?? (mark.kind === 'text' ? 70 : 0))) * scale + 48)) }} onDoubleClick={event => {
      if (tool !== 'select' || (event.target as Element).closest('button, textarea, input, [data-note-edit], .notebook-movable, [data-mark]')) return
      addText(point(event))
    }} onKeyDown={event => {
      if ((event.target as Element).closest('textarea, input, [data-note-edit]')) return
      if (event.key === 'Escape') { setTool('select'); setSelected(null); setEditing(null) }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); remove() }
    }}>
      <div className="notebook-canvas-content">{children}</div>
      <div className="notebook-canvas-space" aria-hidden="true"/>
      <svg className="notebook-ink" viewBox={`0 0 1000 ${size.height / scale}`} aria-label="Drawing layer" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { if (gesture.current) { interacting.current = false; preview(gesture.current.original); gesture.current = null } }}>
        <defs>{(Object.keys(colors) as CanvasColor[]).map(value => <marker key={value} id={`${marker}-${value}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={colors[value]} strokeWidth="1.5"/></marker>)}</defs>
        {data.marks.map(mark => {
          const [first, last = first] = [mark.points[0], mark.points.at(-1)]
          const x = Math.min(first[0], last![0]), y = Math.min(first[1], last![1])
          return <g key={mark.id} data-mark={mark.id} className={`notebook-mark${selected === mark.id ? ' is-selected' : ''}`} style={{ color: colors[mark.color] }} tabIndex={tool === 'select' ? 0 : -1} role="graphics-symbol" aria-label={`${mark.kind}${mark.text ? `: ${mark.text}` : ''}`} onFocus={() => setSelected(mark.id)} onPointerDown={event => {
            if (tool !== 'select' || event.button !== 0) return
            event.preventDefault(); event.stopPropagation(); setSelected(mark.id)
            interacting.current = true; gesture.current = { start: point(event), original: current.current, mark, moving: true }
            event.currentTarget.ownerSVGElement!.setPointerCapture(event.pointerId)
          }} onDoubleClick={event => { event.stopPropagation(); if (mark.kind === 'text' || mark.kind === 'block') { setSelected(mark.id); setEditing(mark.id) } }} onKeyDown={event => {
            if (event.key === 'Enter' && (mark.kind === 'text' || mark.kind === 'block')) { event.preventDefault(); setEditing(mark.id) }
            if (event.key.startsWith('Arrow')) { event.preventDefault(); const dx = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0, dy = event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0; change({ ...current.current, marks: current.current.marks.map(item => item.id === mark.id ? { ...item, points: item.points.map(([px, py]) => [Math.max(0, Math.min(1000, px + dx)), Math.max(0, py + dy)]) } : item) }) }
          }}>
            {mark.kind === 'pen' && <polyline points={mark.points.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
            {mark.kind === 'arrow' && <line x1={first[0]} y1={first[1]} x2={last![0]} y2={last![1]} stroke="currentColor" strokeWidth="3" markerEnd={`url(#${marker}-${mark.color})`}/>}
            {mark.kind === 'block' && <rect x={x} y={y} width={Math.max(12, Math.abs(last![0] - first[0]))} height={Math.max(12, Math.abs(last![1] - first[1]))} rx="10" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeWidth="2"/>}
            {(mark.kind === 'text' || (mark.kind === 'block' && mark.text)) && <CanvasLabel x={x + 8} y={y + 6} width={mark.kind === 'text' ? Math.min(992 - x, Math.max(300, 220 / scale)) : Math.max(60, Math.abs(last![0] - first[0]) - 16)} fontSize={Math.max(24, 16 / scale)} text={mark.text} reportHeight={height => setLabelHeights(previous => previous[mark.id] === height ? previous : { ...previous, [mark.id]: height })}/>}
          </g>
        })}
      </svg>
      {editingMark && <textarea className="notebook-canvas-text" aria-label="Canvas note" autoFocus maxLength={4000} style={{ left: `${Math.min(editingMark.points[0][0], editingMark.points.at(-1)![0]) / 10}%`, top: Math.min(editingMark.points[0][1], editingMark.points.at(-1)![1]) * scale, width: `min(300px, ${100 - Math.min(editingMark.points[0][0], editingMark.points.at(-1)![0]) / 10}%)` }} value={editingMark.text} onChange={event => change({ ...current.current, marks: current.current.marks.map(mark => mark.id === editingMark.id ? { ...mark, text: event.target.value } : mark) })} onBlur={() => setEditing(null)} onKeyDown={event => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); setEditing(null) } }}/>}
      <div className="notebook-canvas-actions">
        {history.length > 0 && <button type="button" title="Undo canvas change" onClick={() => { const previous = history.at(-1)!; change(previous); setHistory(history.slice(0, -1)); setSelected(null); setEditing(null) }}><Undo2 size={14}/> Undo</button>}
        {selectedMark && <><button type="button" onClick={remove}><Trash2 size={14}/> Delete {selectedMark.kind}</button>{(selectedMark.kind === 'text' || selectedMark.kind === 'block') && <button type="button" onClick={() => setEditing(selectedMark.id)}>Write label</button>}</>}
        {saveError ? <button type="button" className="learning-error" onClick={() => void flush()}>{status}</button> : <span role="status">{status}</span>}
      </div>
    </div>
  </CanvasContext.Provider>
}

export function MovableVisual({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const canvas = useContext(CanvasContext)!
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; original: NotebookCanvasData; offset: { x: number; y: number }; minX: number; maxX: number; minY: number; maxY: number } | null>(null)
  const offset = canvas.data.offsets[id] ?? { x: 0, y: 0 }
  const maxX = Math.max(0, (canvas.width - (ref.current?.offsetWidth ?? canvas.width)) / canvas.scale)
  const x = Math.max(0, Math.min(maxX, offset.x))
  const move = (dx: number, dy: number) => canvas.change({ ...canvas.data, offsets: { ...canvas.data.offsets, [id]: { x: Math.max(0, Math.min(maxX, x + dx)), y: Math.max(-1000, Math.min(1000, offset.y + dy)) } } })
  return <div ref={ref} className="notebook-movable" style={{ transform: `translate(${x * canvas.scale}px, ${offset.y * canvas.scale}px)` }}>
    <div className="notebook-visual-grip"><button type="button" aria-label={`Move ${label}`} title="Drag to move; arrow keys nudge" onKeyDown={event => { if (!event.key.startsWith('Arrow')) return; event.preventDefault(); move(event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0, event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0) }} onPointerDown={event => {
      if (event.button !== 0 || canvas.tool !== 'select') return
      event.preventDefault(); const box = ref.current!.getBoundingClientRect(), page = canvas.element!.getBoundingClientRect()
      canvas.begin(); drag.current = { x: event.clientX, y: event.clientY, original: canvas.data, offset: { x, y: offset.y }, minX: -x, maxX: maxX - x, minY: (page.top - box.top) / canvas.scale, maxY: (page.bottom - box.bottom - 32) / canvas.scale }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerMove={event => {
      const active = drag.current; if (!active) return
      const dx = Math.max(active.minX, Math.min(active.maxX, (event.clientX - active.x) / canvas.scale)), dy = Math.max(active.minY, Math.min(active.maxY, (event.clientY - active.y) / canvas.scale))
      canvas.preview({ ...active.original, offsets: { ...active.original.offsets, [id]: { x: active.offset.x + dx, y: active.offset.y + dy } } })
    }} onPointerUp={() => { if (drag.current) { const original = drag.current.original; drag.current = null; canvas.change({ ...original, offsets: { ...original.offsets, [id]: offset } }, original) } }} onPointerCancel={() => { if (drag.current) { canvas.cancel(drag.current.original); drag.current = null } }}><Grip size={15}/> Move visual</button>{(offset.x !== 0 || offset.y !== 0) && <button type="button" onClick={() => canvas.change({ ...canvas.data, offsets: { ...canvas.data.offsets, [id]: { x: 0, y: 0 } } })}>Reset position</button>}</div>
    {children}
  </div>
}

function CanvasLabel({ x, y, width, fontSize, text, reportHeight }: { x: number; y: number; width: number; fontSize: number; text: string; reportHeight: (height: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(70)
  const report = useRef(reportHeight); report.current = reportHeight
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => { const next = Math.max(40, element.scrollHeight); setHeight(next); report.current(next) })
    observer.observe(element); return () => observer.disconnect()
  }, [])
  return <foreignObject x={x} y={y} width={width} height={height}><div ref={ref} className="notebook-canvas-label" style={{ fontSize }}>{text || 'Double-click to write'}</div></foreignObject>
}
