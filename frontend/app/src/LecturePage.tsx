import { useCallback, useEffect, useRef, useState } from 'react'
import type { LectureSession } from '../../../shared/lecture'
import { ArrowLeft, BookOpen, Check, RotateCcw } from './Icons'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey } from './lectureDocument'
import type { CourseSubject } from './curriculum'
import type { ReactNode } from 'react'
import './lecture-notebook.css'
import LectureVisual from './LectureVisual'
import CapturePairingPanel from './CapturePairingPanel'
import { finishLecture, hasLectureVisual, mergeLectureSnapshot, patchLecture, synthesizeLecture, visualizeConcept, watchLectureSnapshots } from './lectures'

function readDraft(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function storeDraft(key: string, value: string) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* The visible draft is retained for this session. */ } }

export default function LecturePage({ id, onBack, suspended, courses = [] }: { id: string; onBack: (courseId?: string) => void; suspended: boolean; courses?: CourseSubject[] }) {
  const [session, setSession] = useState<LectureSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [personalNotes, setPersonalNotes] = useState(() => readDraft(`aha-lecture-personal-${id}`) ?? '')
  const personalDirty = useRef(readDraft(`aha-lecture-personal-${id}`) !== null)
  const personalCurrent = useRef(personalNotes)
  personalCurrent.current = personalNotes
  const [noteSaved, setNoteSaved] = useState(false)
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const accept = useCallback((next: LectureSession) => setSession(previous => mergeLectureSnapshot(previous, next)), [])
  useEffect(() => {
    mounted.current = true
    const stop = watchLectureSnapshots(id, accept, setLoadError, () => setLoading(false))
    return () => { mounted.current = false; stop() }
  }, [id, reload, accept])
  useEffect(() => {
    if (session && !personalDirty.current) setPersonalNotes(session.personalNotes)
  }, [session])
  useEffect(() => { if (session) document.title = `${session.title} — Aha!` }, [session?.title])
  const act = async (name: string, operation: () => Promise<LectureSession>, after?: (next: LectureSession) => void) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(name); setError('')
    try { const next = await operation(); if (mounted.current) { accept(next); after?.(next); return true } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'); return false }
    finally { busyRef.current = false; if (mounted.current) setBusy('') }
  }
  const citations = (ids: string[]) => <span className="source-citations">{[...new Set(ids)].map(sourceId => {
    const source = session?.sources.find(item => item.id === sourceId)
    return source ? <details className="note-citation" key={sourceId}><summary aria-label={`Read source ${source.sequence}`}>{source.sequence}</summary><div><p>{source.text}</p><small>{new Date(source.createdAt).toLocaleString()}</small></div></details> : null
  })}</span>
  if (loading) return <main className="learning-page"><div className="learning-empty" role="status">Opening your lecture…</div></main>
  if (!session) return <main className="learning-page"><button className="learning-back" onClick={() => onBack()}><ArrowLeft size={16}/> All lectures</button><div className="learning-empty"><p role="alert">{loadError || 'This lecture is unavailable.'}</p><button className="secondary-button" onClick={() => { setLoading(true); setReload(value => value + 1) }}>Try again</button></div></main>
  const notesPending = session.status === 'queued' || session.status === 'processing'
  const sections = session.notes ? assignLectureConcepts(session.notes) : []
  const course = courses.find(item => item.id === session.courseId)
  const courseTitle = course?.title ?? (session.courseId ? `Course: ${session.courseId.replace(/[-_]/g, " ")}` : "Independent study")
  return <main className="learning-page lecture-detail-page lecture-notebook">
    <button className="learning-back" onClick={() => onBack(session.courseId ?? '__independent__')}><ArrowLeft size={16}/> {courseTitle}</button>
    <header className="lecture-heading">
      <EditableTitle title={session.title} busy={!!busy} save={title => act('title', () => patchLecture(id, { title }))}/>
      <button className="secondary-button" disabled={!!busy || !!session.finishedAt} onClick={() => { void act('finish', () => finishLecture(id)) }}><Check size={16}/>{session.finishedAt ? 'Finished' : busy === 'finish' ? 'Finishing…' : 'Finish lecture'}</button>
    </header>
    {(error || loadError) && <p className="learning-error" role="alert">{error || loadError} {loadError && <button onClick={() => setReload(value => value + 1)}>Reconnect</button>}</p>}
    <CapturePairingPanel key={id} lectureId={id} autoPair={!session.finishedAt}/>
    <article className="lecture-main-column notebook-paper">
      <section className="learning-panel lecture-notes-panel" aria-labelledby="generated-notes-heading">
        <div className="learning-section-heading"><h2 id="generated-notes-heading"><BookOpen size={20}/> Notes</h2>{session.sources.length > 0 && (session.status === 'failed' || (!notesPending && session.synthesizedRevision < session.sourceRevision)) && <button className="learning-text-button" disabled={!!busy} onClick={() => { void act('synthesize', () => synthesizeLecture(id)) }}><RotateCcw size={14}/>{session.status === 'failed' ? 'Retry notes' : 'Update notes'}</button>}</div>
        {session.status === 'failed' && <p className="learning-error" role="alert">{session.error || 'Notes could not update. Your recordings are saved.'}</p>}
        {notesPending && <p className="lecture-progress" role="status"><span className="working-dot"/>Updating notes…</p>}
        {session.notes ? <div className="generated-notes">
          <section className="notebook-section"><EditableNote lectureId={id} noteKey="summary" aiText={session.notes.summary} session={session} busy={!!busy} save={value => act('edit-summary', () => patchLecture(id, { noteEdits: { summary: value } }))}/></section>
          {sections.map(section => <section id={`notebook-${notebookSectionKey(section.id)}`} className="notebook-section" key={section.id}>
            <h3>{section.title}</h3>
            <EditableNote lectureId={id} noteKey={`section:${section.id}`} aiText={section.points.map(point => point.text).join('\n')} session={session} busy={!!busy} save={value => act('edit-section', () => patchLecture(id, { noteEdits: { [`section:${section.id}`]: value } }))}><ul>{section.points.map((point,index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></EditableNote>
            {section.concepts.map(concept => {
              const visual = [...session.visualizations].reverse().find(item => item.conceptId === concept.id)
              const pending = visual?.status === 'queued' || visual?.status === 'processing'
              return <figure className="notebook-figure" key={concept.id}><figcaption><h4>{concept.title}</h4></figcaption><p className="concept-explanation">{concept.explanation}{citations(concept.sourceIds)}</p>{hasLectureVisual(visual) && <LectureVisual key={visual.id} visualization={visual} suspended={suspended}/>}
                {pending && <p className="lecture-progress" role="status">Updating visual…</p>}
                {visual?.status === 'failed' && <p className="learning-error" role="alert">{visual.error || 'Visual could not update.'}</p>}
                {visual && !pending && (visual.status === 'failed' || visual.sourceRevision < session.sourceRevision) && <button className="learning-text-button" disabled={!!busy} onClick={() => { void act('visualize', () => visualizeConcept(id, concept.id)) }}>{visual.status === 'failed' ? 'Retry visual' : 'Update visual from new material'}</button>}
              </figure>
            })}
          </section>)}
          {session.notes.questions.length > 0 && <section className="notebook-section"><h3>Questions</h3><ul>{session.notes.questions.map((point,index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></section>}
        </div> : !notesPending && <div className="learning-empty compact"><p>Scan the QR code and start recording. Notes appear here automatically.</p></div>}
        <details className="personal-notes-panel" open={personalNotes.trim() ? true : undefined}>
          <summary>Your notes{personalDirty.current ? ' · Unsaved changes' : noteSaved ? ' · Saved' : ''}</summary>
          <textarea aria-label="Your notes" rows={3} value={personalNotes} placeholder="Add a thought or question…" maxLength={100000} onChange={event => { personalDirty.current = true; setNoteSaved(false); setPersonalNotes(event.target.value); storeDraft(`aha-lecture-personal-${id}`, event.target.value || '\n') }}/>
          <button className="learning-text-button" disabled={!!busy || !personalDirty.current} onClick={() => { const draft = personalNotes; void act('personal', () => patchLecture(id, { personalNotes: draft }), () => { if (personalCurrent.current === draft) { personalDirty.current = false; storeDraft(`aha-lecture-personal-${id}`, ''); setNoteSaved(true) } }) }}>{busy === 'personal' ? 'Saving…' : 'Save my notes'}</button>
        </details>
      </section>
    </article>
  </main>
}

function EditableTitle({ title, busy, save }: { title: string; busy: boolean; save: (value: string) => Promise<boolean | undefined> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  return editing ? <form className="notebook-title-edit" onSubmit={event => { event.preventDefault(); if (draft.trim()) void save(draft.trim()).then(saved => { if (saved) setEditing(false) }) }}><input aria-label="Lecture title" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} autoFocus/><button disabled={busy || !draft.trim()} className="secondary-button">Save title</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></form> : <div className="notebook-title"><h1>{title}</h1><button className="learning-text-button" aria-label="Rename lecture" onClick={() => { setDraft(title); setEditing(true) }}>Rename</button></div>
}
function EditableNote({ lectureId, noteKey, aiText, session, busy, save, children }: { lectureId: string; noteKey: string; aiText: string; session: LectureSession; busy: boolean; save: (value: string | null) => Promise<boolean | undefined>; children?: ReactNode }) {
  const draftKey = `aha-lecture-edit-${lectureId}-${noteKey}`
  const [draft, setDraft] = useState(() => readDraft(draftKey) ?? lectureNoteText(session, noteKey, aiText))
  const [editing, setEditing] = useState(() => readDraft(draftKey) !== null)
  const edited = session.noteEdits?.[noteKey] !== undefined
  const finish = async (value: string | null) => { if (await save(value)) { storeDraft(draftKey, ''); setEditing(false) } }
  return <div className="notebook-editable">{editing ? <><label className="learning-muted" htmlFor={`edit-${noteKey}`}>Your version · original AI notes remain available</label><textarea id={`edit-${noteKey}`} aria-label={noteKey === 'summary' ? 'Edit lecture overview' : 'Edit section notes'} value={draft} disabled={busy} rows={Math.max(4, Math.min(12, draft.split('\n').length + 2))} maxLength={100000} onChange={event => { setDraft(event.target.value); storeDraft(draftKey, event.target.value || '\n') }}/><div className="notebook-edit-actions"><button className="secondary-button" disabled={busy} onClick={() => void finish(draft)}>Save changes</button><button disabled={busy} onClick={() => { storeDraft(draftKey, ''); setEditing(false) }}>Cancel</button></div></> : <>{edited ? <><span className="notebook-edited">Edited by you</span><p className="notebook-edited-text">{lectureNoteText(session, noteKey, aiText)}</p></> : children ?? <p className="lecture-summary">{aiText}</p>}<div className="notebook-edit-actions"><button className="learning-text-button" onClick={() => { setDraft(lectureNoteText(session, noteKey, aiText)); setEditing(true) }}>Edit {noteKey === 'summary' ? 'overview' : 'notes'}</button>{edited && <button className="learning-text-button" disabled={busy} onClick={() => void finish(null)}>Reset to AI notes</button>}</div></>}</div>
}
