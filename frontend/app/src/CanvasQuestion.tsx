import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent, RefObject } from 'react'
import type { SceneRequestContext } from '../../../shared/video/scene-requests'
import { ArrowUpRight } from './Icons'
import './canvas-question.css'

type Point = { x: number; y: number }
const questionColors = ['butter', 'sage', 'lavender', 'blue', 'peach'] as const

export type CanvasQuestionContext = SceneRequestContext

export interface CanvasQuestionDraft {
  id: number
  closing: boolean
  color: typeof questionColors[number]
  question: string
  context: CanvasQuestionContext
  anchor: Point
}

export function useCanvasQuestion({ lesson, time, disabled = false, getScene }: {
  lesson: { id: string; title: string; subject: string }
  time: number
  disabled?: boolean
  getScene?: () => CanvasQuestionContext['scene']
}) {
  const [draft, setDraft] = useState<CanvasQuestionDraft | null>(null)
  const nextColor = useRef(0)
  const closeQuestion = useCallback((id?: number) => {
    setDraft(current => current && (id === undefined || current.id === id) && !current.closing ? { ...current, closing: true } : current)
  }, [])
  const changeQuestion = useCallback((question: string) => {
    setDraft(current => current ? { ...current, question } : null)
  }, [])

  useEffect(() => { if (disabled) closeQuestion() }, [disabled, closeQuestion])

  // Keep the captured moment mounted through its exit animation. A new right-click
  // cancels dismissal, so a pending exit can never remove the next question.
  useEffect(() => {
    if (!draft?.closing) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      setDraft(current => current?.closing ? null : current)
    }, reducedMotion ? 0 : 180)
    return () => window.clearTimeout(timer)
  }, [draft?.closing])

  const openQuestion = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || !(event.target instanceof Element)) return
    if (event.target.closest('button,input,textarea,select,[contenteditable],.canvas-question,.player-controls,.player-menu-anchor,.player-status,.player-notice,.scene-request-status,.lesson-complete')) return
    event.preventDefault()
    const screen = event.currentTarget.getBoundingClientRect()
    const surface = (event.currentTarget.querySelector('canvas') ?? event.currentTarget).getBoundingClientRect()
    if (!surface.width || !surface.height || !screen.width || !screen.height) return
    const x = Math.max(0, Math.min(surface.width, event.clientX - surface.left))
    const y = Math.max(0, Math.min(surface.height, event.clientY - surface.top))
    const subject = event.target.closest('[data-question-subject]')
    // Capture the displayed scene before placing the request box.
    setDraft({
      id: nextColor.current,
      closing: false,
      color: questionColors[nextColor.current++ % questionColors.length],
      question: '',
      anchor: { x: (event.clientX - screen.left) / screen.width, y: (event.clientY - screen.top) / screen.height },
      context: {
        lessonId: lesson.id, lessonTitle: lesson.title, subject: lesson.subject, time,
        label: subject?.getAttribute('data-question-subject') || 'Selected region',
        elementId: subject?.getAttribute('data-question-id') || undefined,
        point: { x, y }, normalizedPoint: { x: x / surface.width, y: y / surface.height },
        surface: { width: surface.width, height: surface.height },
        scene: getScene?.(),
      },
    })
  }

  return { draft, openQuestion, closeQuestion, changeQuestion }
}

export default function CanvasQuestion({ draft, screen, onChange, onClose, onSubmit }: {
  draft: CanvasQuestionDraft
  screen: RefObject<HTMLDivElement | null>
  onChange: (question: string) => void
  onClose: () => void
  onSubmit: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, x: 0, y: 0 })

  useLayoutEffect(() => {
    const root = screen.current
    const popup = panel.current
    if (!root || !popup) return
    const place = () => {
      const { width, height } = root.getBoundingClientRect()
      const x = draft.anchor.x * width
      const y = draft.anchor.y * height
      const gap = 12
      const left = x + gap + popup.offsetWidth > width - gap ? x - popup.offsetWidth - gap : x + gap
      const top = y + gap + popup.offsetHeight > height - gap ? y - popup.offsetHeight - gap : y + gap
      setPosition({ x, y,
        left: Math.max(gap, Math.min(left, width - popup.offsetWidth - gap)),
        top: Math.max(gap, Math.min(top, height - popup.offsetHeight - gap)),
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(root)
    observer.observe(popup)
    input.current?.focus({ preventScroll: true })
    return () => observer.disconnect()
  }, [draft.anchor, screen])

  useEffect(() => {
    if (draft.closing) return
    const outside = (event: PointerEvent) => {
      if (event.button === 0 && event.target instanceof Node && !panel.current?.contains(event.target)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
      screen.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', escape, true)
    }
  }, [draft.closing, onClose, screen])

  return <>
    <span key={`pin-${draft.id}`} className={`canvas-question-pin ${draft.closing ? 'is-closing' : ''}`} style={{ left: position.x, top: position.y }} aria-hidden="true"/>
    <div key={draft.id} ref={panel} className={`canvas-question ${draft.color} ${draft.closing ? 'is-closing' : ''}`} style={{ left: position.left, top: position.top, transformOrigin: `${position.x - position.left}px ${position.y - position.top}px` }} role="dialog" aria-label="Ask about this moment" aria-hidden={draft.closing || undefined} inert={draft.closing}>
      <form className="canvas-question-field" onSubmit={event => {
        event.preventDefault()
        if (!draft.question.trim() || submitting.current) return
        submitting.current = true; setPending(true); setError('')
        void onSubmit().catch(error => setError(error instanceof Error ? error.message : 'Could not add scenes. Try again.'))
          .finally(() => { submitting.current = false; setPending(false) })
      }}>
        <input ref={input} aria-label="Question about the selected region" placeholder="Explain this, or make a toy…" disabled={pending} value={draft.question} onChange={event => onChange(event.target.value)} maxLength={2000} autoComplete="off"/>
        <button type="submit" disabled={pending || !draft.question.trim()} aria-label="Add scenes" title="Add scenes after this scene"><ArrowUpRight size={16}/></button>
      </form>
      <p className="canvas-question-hint" role="status">{pending ? 'Sending your request…' : 'New scenes will follow this scene.'}</p>
      {error && <p className="canvas-question-error" role="alert">{error}</p>}
    </div>
  </>
}
