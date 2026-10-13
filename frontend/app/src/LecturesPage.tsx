import { useEffect, useRef, useState } from 'react'
import type { CourseSubject } from './curriculum'
import type { LectureSummary } from '../../../shared/lecture'
import { createLecture, lectureStatus, listLectures } from './lectures'
import { ArrowRight, BookOpen, FileText, Plus, Search } from './Icons'

export const lectureDate = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export default function LecturesPage({ courses, onOpen }: { courses: CourseSubject[]; onOpen: (id: string) => void }) {
  const [lectures, setLectures] = useState<LectureSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const request = useRef({ body: '', key: crypto.randomUUID() })
  const submitted = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void listLectures(controller.signal).then(setLectures).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load lectures.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry])
  const visible = lectures.filter(lecture => `${lecture.title} ${courses.find(course => course.id === lecture.courseId)?.title ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <main className="learning-page lectures-page">
    <div className="learning-heading"><span className="learning-eyebrow">Lecture workspace</span><h1>Keep up. Make sense.</h1><p>Bring in what you’re learning. Build clear notes and explore the ideas as they unfold.</p></div>
    <div className="lectures-layout">
      <section className="new-lecture-panel learning-panel" aria-labelledby="new-lecture-heading">
        <span className="learning-panel-icon sage"><BookOpen size={25}/></span>
        <h2 id="new-lecture-heading">Start a lecture</h2><p>A place for your material, your notes, and the moments that click.</p>
        <form onSubmit={async event => {
          event.preventDefault()
          if (submitted.current || !title.trim()) return
          submitted.current = true; setCreating(true); setCreateError('')
          const body = { title: title.trim(), ...(courseId ? { courseId } : {}) }
          const serialized = JSON.stringify(body)
          if (request.current.body !== serialized) request.current = { body: serialized, key: crypto.randomUUID() }
          try { const next = await createLecture(body, request.current.key); if (mounted.current) onOpen(next.id) }
          catch (reason) { if (mounted.current) setCreateError(reason instanceof Error ? reason.message : 'Could not create your lecture.') }
          finally { submitted.current = false; if (mounted.current) setCreating(false) }
        }}>
          <label htmlFor="lecture-title">Lecture title</label><input id="lecture-title" required maxLength={200} placeholder="e.g. Eigenvectors, finally" value={title} disabled={creating} onChange={event => setTitle(event.target.value)}/>
          <label htmlFor="lecture-course">Course <span>optional</span></label><select id="lecture-course" value={courseId} disabled={creating} onChange={event => setCourseId(event.target.value)}><option value="">Independent learning</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
          {createError && <p className="learning-error" role="alert">{createError}</p>}
          <button className="primary-button" disabled={creating || !title.trim()}>{creating ? 'Creating your space…' : 'Start lecture'}<Plus size={17}/></button>
        </form>
        <div className="lecture-start-note"><FileText size={16}/><span>Start with text. Add more material whenever you need.</span></div>
      </section>
      <section className="lecture-list-section" aria-labelledby="lecture-list-heading">
        <div className="learning-section-heading"><h2 id="lecture-list-heading">Your lectures <span>{lectures.length}</span></h2><label className="learning-search"><Search size={17}/><input aria-label="Search lectures" placeholder="Find a lecture" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
        {loading ? <div className="learning-empty" role="status">Loading your lectures…</div> : error ? <div className="learning-empty"><p role="alert">{error}</p><button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : visible.length ? <div className="lecture-list">{visible.map(lecture => <button key={lecture.id} className="lecture-list-row" onClick={() => onOpen(lecture.id)}>
          <span className={`lecture-row-icon ${courses.find(course => course.id === lecture.courseId)?.color ?? 'sage'}`}><BookOpen size={21}/></span>
          <span className="lecture-row-body"><strong>{lecture.title}</strong><span>{courses.find(course => course.id === lecture.courseId)?.title ?? 'Independent learning'} · {lectureDate(lecture.updatedAt)}</span></span>
          <span className={`lecture-status status-${lecture.status}`}>{lectureStatus(lecture)}</span><ArrowRight size={17}/>
        </button>)}</div> : <div className="learning-empty"><BookOpen size={36}/><h3>{query ? 'No matching lectures' : 'Your next insight starts here'}</h3><p>{query ? 'Try another title or course.' : 'Start a lecture, add your material, and come back to everything in one place.'}</p></div>}
      </section>
    </div>
  </main>
}
