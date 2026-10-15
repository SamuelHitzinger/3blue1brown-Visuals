import { useCallback, useEffect, useRef, useState } from 'react'
import type { LectureConcept, LectureSession } from '../../../shared/lecture'
import { ArrowLeft, BookOpen, Check, RotateCcw } from './Icons'
import { assignLectureConcepts, assignNotebookGroups, lectureNoteText, notebookFigureCaption, notebookSectionKey, notebookEditText } from './lectureDocument'
import type { CourseSubject } from './curriculum'
import type { ReactNode } from 'react'
import './lecture-notebook.css'
import LectureVisual from './LectureVisual'
import LecturePhoto from './LecturePhoto'
import NotebookLines from './NotebookLines'
import LectureDiagram, { ConceptText } from './LectureDiagram'
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
    <div className="notebook-layout">
    <article className="lecture-main-column notebook-paper">
      <section className="learning-panel lecture-notes-panel" aria-labelledby="generated-notes-heading">
        <div className="learning-section-heading"><h2 id="generated-notes-heading"><BookOpen size={20}/> Notes</h2>{session.sources.length > 0 && !notesPending && <button className="learning-text-button" disabled={!!busy} onClick={() => { void act('synthesize', () => synthesizeLecture(id)) }}><RotateCcw size={14}/>{session.status === 'failed' ? 'Retry notes' : 'Update notes'}</button>}</div>
        {session.status === 'failed' && <p className="learning-error" role="alert">{session.error || 'Notes could not update. Your recordings are saved.'}</p>}
        {notesPending && <p className="lecture-progress" role="status"><span className="working-dot"/>Updating notes…</p>}
        {session.notes ? <div className="generated-notes">
          {(session.notes.summary || session.noteEdits?.summary) && <section className="notebook-section notebook-overview"><EditableNote lectureId={id} noteKey="summary" aiText={session.notes.summary} session={session} busy={!!busy} save={value => act('edit-summary', () => patchLecture(id, { noteEdits: { summary: value } }))}/></section>}
          {!sections.length && <p className="learning-muted">New concepts will appear here as they are taught.</p>}
          {sections.map(section => <section id={`notebook-${notebookSectionKey(section.id)}`} className="notebook-section" key={section.id}>
            <h3>{lectureNoteText(session, `heading:${section.id}`, section.title)}</h3>
            <div className="notebook-section-body">
            <EditableNote lectureId={id} noteKey={`section:${section.id}`} aiText={notebookEditText(section.points)} session={session} busy={!!busy} save={value => act('edit-section', () => patchLecture(id, { noteEdits: { [`section:${section.id}`]: value } }))}
              figures={section.concepts.map(concept => <ConceptFigure key={concept.id} concept={concept} session={session} suspended={suspended} busy={!!busy} update={() => { void act('visualize', () => visualizeConcept(id, concept.id)) }}/>) }>
              <div className="notebook-note-groups">{assignNotebookGroups(section.points, section.concepts).map((group, index) => <div className={`notebook-note-group${group.concepts.length ? ' has-figures' : ''}${group.concepts.some(concept => concept.visualKind !== 'static') ? ' has-rich-figures' : ''}${group.fullWidthText ? ' full-width-text' : ''}`} key={index}>
                {group.title && <h4 className="notebook-group-title">{group.title}</h4>}
                {!!group.concepts.length && <div className="notebook-group-figures">{group.concepts.map(concept => <ConceptFigure key={concept.id} concept={concept} session={session} suspended={suspended} busy={!!busy} update={() => { void act('visualize', () => visualizeConcept(id, concept.id)) }}/>)}</div>}
                {!!group.points.length && (group.supportSplit ? <div className="notebook-support-columns"><NotebookLines points={group.points.slice(0, group.supportSplit)} showGroupTitles={false}/><NotebookLines points={group.points.slice(group.supportSplit)} showGroupTitles={false}/></div> : <NotebookLines points={group.points} terms={group.concepts.flatMap(concept => concept.terms ?? [])} showGroupTitles={false}/>)}
              </div>)}</div>
            </EditableNote>
            {section.photo && <LecturePhoto key={section.photo.sourceId} photo={section.photo} session={session}/>}
            </div>
          </section>)}
        </div> : !notesPending && <div className="learning-empty compact"><p>Scan the QR code and start recording. Notes appear here automatically.</p></div>}
        <details className="personal-notes-panel" open={personalNotes.trim() ? true : undefined}>
          <summary>Your notes{personalDirty.current ? ' · Unsaved changes' : noteSaved ? ' · Saved' : ''}</summary>
          <textarea aria-label="Your notes" rows={3} value={personalNotes} placeholder="Add a thought or question…" maxLength={100000} onChange={event => { personalDirty.current = true; setNoteSaved(false); setPersonalNotes(event.target.value); storeDraft(`aha-lecture-personal-${id}`, event.target.value || '\n') }}/>
          <button className="learning-text-button" disabled={!!busy || !personalDirty.current} onClick={() => { const draft = personalNotes; void act('personal', () => patchLecture(id, { personalNotes: draft }), () => { if (personalCurrent.current === draft) { personalDirty.current = false; storeDraft(`aha-lecture-personal-${id}`, ''); setNoteSaved(true) } }) }}>{busy === 'personal' ? 'Saving…' : 'Save my notes'}</button>
        </details>
      </section>
    {!!session.notes?.questions.length && <section className="notebook-questions" aria-labelledby="lecture-questions-heading">
      <h2 id="lecture-questions-heading">Questions</h2><p className="questions-intro">Problems from your lecture</p>
      <ol>{session.notes.questions.map((question, index) => <li key={index}><p>{lectureNoteText(session, `question:${index}`, question.text)}</p>{question.diagram && <LectureDiagram diagram={question.diagram}/>}</li>)}</ol>
    </section>}
    </article>
    </div>
  </main>
}

function ConceptFigure({ concept, session, suspended, busy, update }: { concept: LectureConcept; session: LectureSession; suspended: boolean; busy: boolean; update: () => void }) {
  const visual = concept.visualKind === 'static' ? undefined : [...session.visualizations].reverse().find(item => item.conceptId === concept.id)
  const pending = visual?.status === 'queued' || visual?.status === 'processing'
  const caption = notebookFigureCaption(session, concept)
  return <figure className={`notebook-figure${concept.visualKind === 'static' ? ' notebook-sketch' : ''}`} aria-label={concept.title}>
    {(caption.title || caption.explanation) && <figcaption>{caption.title && <h4>{caption.title}</h4>}{caption.explanation && <p className="concept-explanation"><ConceptText text={caption.explanation} terms={concept.terms}/></p>}</figcaption>}
    {concept.visualKind === 'static' && concept.diagram && <LectureDiagram diagram={concept.diagram}/>}
    {hasLectureVisual(visual) && <LectureVisual key={visual.id} visualization={visual} suspended={suspended}/>}
    {pending && <p className="lecture-progress" role="status">Updating visual…</p>}
    {visual?.status === 'failed' && <p className="learning-error" role="alert">{visual.error || 'Visual could not update.'}</p>}
    {visual && !pending && (visual.status === 'failed' || visual.stale || visual.sourceRevision < session.sourceRevision) && <button className="learning-text-button" disabled={busy} onClick={update}>{visual.status === 'failed' ? 'Retry visual' : 'Update visual from new material'}</button>}
    {!visual && concept.visualKind !== 'static' && <button className="learning-text-button" disabled={busy} onClick={update}>Create {concept.visualKind === 'animation' ? 'animation' : 'interactive visual'}</button>}
  </figure>
}

function EditableTitle({ title, busy, save }: { title: string; busy: boolean; save: (value: string) => Promise<boolean | undefined> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  return editing ? <form className="notebook-title-edit" onSubmit={event => { event.preventDefault(); if (draft.trim()) void save(draft.trim()).then(saved => { if (saved) setEditing(false) }) }}><input aria-label="Lecture title" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} autoFocus/><button disabled={busy || !draft.trim()} className="secondary-button">Save title</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></form> : <div className="notebook-title"><h1>{title}</h1><button className="learning-text-button" aria-label="Rename lecture" onClick={() => { setDraft(title); setEditing(true) }}>Rename</button></div>
}
function EditableNote({ lectureId, noteKey, aiText, session, busy, save, children, figures }: { lectureId: string; noteKey: string; aiText: string; session: LectureSession; busy: boolean; save: (value: string | null) => Promise<boolean | undefined>; children?: ReactNode; figures?: ReactNode }) {
  const draftKey = `aha-lecture-edit-${lectureId}-${noteKey}`
  const [draft, setDraft] = useState(() => readDraft(draftKey) ?? lectureNoteText(session, noteKey, aiText))
  const [editing, setEditing] = useState(() => readDraft(draftKey) !== null)
  const edited = session.noteEdits?.[noteKey] !== undefined
  const finish = async (value: string | null) => { if (await save(value)) { storeDraft(draftKey, ''); setEditing(false) } }
    return <div className="notebook-editable">{editing ? <><label className="learning-muted" htmlFor={`edit-${noteKey}`}>Your version · original AI notes remain available</label><textarea id={`edit-${noteKey}`} aria-label={noteKey === 'summary' ? 'Edit lecture overview' : 'Edit section notes'} value={draft} disabled={busy} rows={Math.max(4, Math.min(12, draft.split('\n').length + 2))} maxLength={40000} onChange={event => { setDraft(event.target.value); storeDraft(draftKey, event.target.value || '\n') }}/><div className="notebook-edit-actions"><button className="secondary-button" disabled={busy} onClick={() => void finish(draft)}>Save changes</button><button disabled={busy} onClick={() => { storeDraft(draftKey, ''); setEditing(false) }}>Cancel</button></div></> : <>{edited ? <><span className="notebook-edited">Edited by you</span><p className="notebook-edited-text">{lectureNoteText(session, noteKey, aiText)}</p></> : children ?? <p className="lecture-summary">{aiText}</p>}<button className="notebook-edit-button" aria-label={noteKey === 'summary' ? 'Edit lecture overview' : 'Edit section notes'} title={noteKey === 'summary' ? 'Edit overview' : 'Edit notes'} disabled={busy} onClick={() => { setDraft(lectureNoteText(session, noteKey, aiText)); setEditing(true) }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-13 13-6 1 1-6Z M14 5l5 5"/></svg></button>{edited && <div className="notebook-edit-actions"><button className="learning-text-button" disabled={busy} onClick={() => void finish(null)}>Reset to AI notes</button></div>}</>}{(editing || edited) && figures && <div className="notebook-edit-figures">{figures}</div>}</div>
}
