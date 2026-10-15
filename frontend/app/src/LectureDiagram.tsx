import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { LectureDiagram as Diagram, LectureConcept } from '../../../shared/lecture'
import type { ReactNode } from 'react'
import { findNoteTerm } from './lectureDocument'

export function ConceptText({ text, terms = [] }: { text: string; terms?: NonNullable<LectureConcept['terms']> }) {
  const parts: ReactNode[] = []
  const sorted = [...terms].filter(term => term.text).sort((a, b) => b.text.length - a.text.length)
  let cursor = 0
  while (cursor < text.length) {
    let next = text.length
    let match: (typeof sorted)[number] | undefined
    for (const term of sorted) {
      const index = findNoteTerm(text, term.text, cursor)
      if (index >= 0 && index < next) { next = index; match = term }
    }
    if (next > cursor) parts.push(text.slice(cursor, next))
    if (!match) break
    parts.push(<span className={`note-term note-color-${match.color}`} key={next}>{match.text}</span>)
    cursor = next + match.text.length
  }
  return <>{parts}</>
}

export default function LectureDiagram({ diagram }: { diagram: Diagram }) {
  const id = useId().replace(/:/g, '')
  const drawing = useRef<SVGGElement>(null)
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 600, height: 340 })
  useLayoutEffect(() => {
    let active = true
    const measure = () => {
      if (!active || !drawing.current || !diagram.elements.length) return
      const bounds = drawing.current.getBBox()
      // Actual glyph bounds keep long labels intact; padding includes arrowheads/strokes.
      const padding = 18
      setFrame({ x: bounds.x - padding, y: bounds.y - padding, width: Math.max(48, bounds.width + padding * 2), height: Math.max(48, bounds.height + padding * 2) })
    }
    measure()
    void document.fonts.ready.then(measure)
    return () => { active = false }
  }, [diagram])
  return <div className="notebook-diagram-scroll" tabIndex={0} role="region" aria-label={diagram.alt}><svg className="note-diagram" viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} style={{ minWidth: frame.width * .75, maxWidth: frame.width }} role="img" aria-labelledby={`${id}-title`}>
    <title id={`${id}-title`}>{diagram.alt}</title>
    <defs>{(['blue', 'teal', 'amber', 'ink'] as const).map(color => <marker key={color} id={`${id}-${color}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6" className={`note-color-${color}`} fill="currentColor"/></marker>)}</defs>
    <g ref={drawing}>{diagram.elements.map((element, index) => {
      const className = `note-color-${element.color ?? 'ink'}`
      switch (element.type) {
        case 'text': return <text key={index} x={element.x} y={element.y} className={className} textAnchor="middle" dominantBaseline="middle" fill="currentColor">{element.text}</text>
        case 'line': return <line key={index} x1={element.x1} y1={element.y1} x2={element.x2} y2={element.y2} className={className} stroke="currentColor" strokeWidth="2.5" markerEnd={element.arrow ? `url(#${id}-${element.color ?? 'ink'})` : undefined}/>
        case 'circle': return <circle key={index} cx={element.cx} cy={element.cy} r={element.r} className={className} stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".06"/>
        case 'rect': return <rect key={index} x={element.x} y={element.y} width={element.width} height={element.height} rx="4" className={className} stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".06"/>
        case 'polyline': return <polyline key={index} points={element.points.map(point => point.join(',')).join(' ')} className={className} stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
        case 'polygon': return <polygon key={index} points={element.points.map(point => point.join(',')).join(' ')} className={className} stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".12" strokeLinejoin="round"/>
      }
    })}</g>
  </svg></div>
}
