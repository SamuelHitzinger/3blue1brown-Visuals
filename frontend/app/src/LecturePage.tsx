import { useCallback, useEffect, useRef, useState } from 'react'
import type { LectureConcept, LectureSession } from '../../../shared/lecture'
import { ArrowLeft, BookOpen, Check, RotateCcw } from './Icons'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey, notebookEditText } from './lectureDocument'
import type { CourseSubject } from './curriculum'
import type { ReactNode } from 'react'
import './lecture-notebook.css'
import LectureVisual from './LectureVisual'
import LecturePhoto from './LecturePhoto'
import NotebookLines from './NotebookLines'
import NotebookCanvas, { MovableVisual, NotebookTools } from './NotebookCanvas'
import type { CanvasColor, CanvasTool } from '../../../shared/notebookCanvas'
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
  const [tool, setTool] = useState<CanvasTool>('select')
  const [color, setColor] = useState<CanvasColor>('blue')
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const accept = useCallback((next: LectureSession) => setSession(previous => mergeLectureSnapshot(previous, next)), [])
  useEffect(() => {
    mounted.current = true
    const stop = watchLectureSnapshots(id, accept, setLoadError, () => setLoading(false))
    return () => { mounted.current = false; stop() }
  }, [id, reload, accept])
  useEffect(() => { if (session) document.title = `${session.title} — Aha!` }, [session?.title])
  const act = async (name: string, operation: () => Promise<LectureSession>, after?: (next: LectureSession) => void) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(name); setError('')
    try { const next = await operation(); if (mounted.current) { accept(next); after?.(next); return true } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'); return false }
    finally { busyRef.current = false; if (mounted.current) setBusy('') }
  }
  const saveText = async (key: string, value: string | null) => {
    try { accept(await patchLecture(id, key === 'personal' ? { personalNotes: value ?? '' } : { noteEdits: { [key]: value } })); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save notes. Your draft is kept.'); return false }
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
        <NotebookTools tool={tool} setTool={setTool} color={color} setColor={setColor}/>
        {session.notes ? <div className="generated-notes">
          {(session.notes.summary || session.noteEdits?.summary) && <section className="notebook-section notebook-overview"><NotebookCanvas lectureId={id} area="overview" value={session.noteCanvas?.overview} save={async data => accept(await patchLecture(id, { noteCanvas: { overview: data } }))} tool={tool} setTool={setTool} color={color}><EditableNote lectureId={id} noteKey="summary" aiText={session.notes.summary} session={session} save={value => saveText('summary', value)}/></NotebookCanvas></section>}
          {!sections.length && <p className="learning-muted">New concepts will appear here as they are taught.</p>}
          {sections.map(section => <section id={`notebook-${notebookSectionKey(section.id)}`} className="notebook-section" key={section.id}>
            <NotebookCanvas lectureId={id} area={section.id} value={session.noteCanvas?.[section.id]} save={async data => accept(await patchLecture(id, { noteCanvas: { [section.id]: data } }))} tool={tool} setTool={setTool} color={color}>
              <EditableNote lectureId={id} noteKey={`heading:${section.id}`} aiText={section.title} session={session} save={value => saveText(`heading:${section.id}`, value)}><h3>{lectureNoteText(session, `heading:${section.id}`, section.title)}</h3></EditableNote>
              <div className="notebook-section-body">
                <EditableNote lectureId={id} noteKey={`section:${section.id}`} aiText={notebookEditText(section.points)} session={session} save={value => saveText(`section:${section.id}`, value)}><NotebookLines points={section.points} terms={section.concepts.flatMap(concept => concept.terms ?? [])}/></EditableNote>
                {section.photo && <MovableVisual id={`photo:${section.photo.sourceId}`} label="board photo"><LecturePhoto key={section.photo.sourceId} photo={section.photo} session={session}/></MovableVisual>}
                {section.concepts.map(concept => <MovableVisual key={concept.id} id={concept.id} label={concept.title}><ConceptFigure concept={concept} session={session} suspended={suspended} busy={!!busy} saveText={saveText} update={() => { void act('visualize', () => visualizeConcept(id, concept.id)) }}/></MovableVisual>)}
              </div>
            </NotebookCanvas>
          </section>)}
        </div> : !notesPending && <div className="learning-empty compact"><p>Scan the QR code and start recording. Notes appear here automatically.</p></div>}
        <NotebookCanvas lectureId={id} area="personal" value={session.noteCanvas?.personal} save={async data => accept(await patchLecture(id, { noteCanvas: { personal: data } }))} tool={tool} setTool={setTool} color={color}>
          <EditableNote lectureId={id} noteKey="personal" aiText={session.personalNotes} session={session} save={value => saveText('personal', value)}/>
        </NotebookCanvas>
    {!!session.notes?.questions.length && <section className="notebook-questions" aria-labelledby="lecture-questions-heading">
      <h2 id="lecture-questions-heading">Questions</h2><p className="questions-intro">Problems from your lecture</p>
      <NotebookCanvas lectureId={id} area="questions" value={session.noteCanvas?.questions} save={async data => accept(await patchLecture(id, { noteCanvas: { questions: data } }))} tool={tool} setTool={setTool} color={color}>
        <ol>{session.notes.questions.map((question, index) => <li key={index}><EditableNote lectureId={id} noteKey={`question:${index}`} aiText={question.text} session={session} save={value => saveText(`question:${index}`, value)}><p>{question.text}</p></EditableNote>{question.diagram && <MovableVisual id={`question:${index}`} label={`question ${index + 1} diagram`}><LectureDiagram diagram={question.diagram}/></MovableVisual>}</li>)}</ol>
      </NotebookCanvas>
    </section>}
      </section>
    </article>
    </div>
  </main>
}

function ConceptFigure({ concept, session, suspended, busy, update, saveText }: { concept: LectureConcept; session: LectureSession; suspended: boolean; busy: boolean; update: () => void; saveText: (key: string, value: string | null) => Promise<boolean> }) {
  const visual = concept.visualKind === 'static' ? undefined : [...session.visualizations].reverse().find(item => item.conceptId === concept.id)
  const pending = visual?.status === 'queued' || visual?.status === 'processing'
  return <figure className={`notebook-figure${concept.visualKind === 'static' ? ' notebook-sketch' : ''}`} aria-label={concept.title}>
    <figcaption><EditableNote lectureId={session.id} noteKey={`concept-title:${concept.id}`} aiText={concept.title} session={session} save={value => saveText(`concept-title:${concept.id}`, value)}><h4>{lectureNoteText(session, `concept-title:${concept.id}`, concept.title)}</h4></EditableNote><EditableNote lectureId={session.id} noteKey={`concept:${concept.id}`} aiText={concept.explanation} session={session} save={value => saveText(`concept:${concept.id}`, value)}><p className="concept-explanation"><ConceptText text={concept.explanation} terms={concept.terms}/></p></EditableNote></figcaption>
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
function EditableNote({ lectureId, noteKey, aiText, session, save, children }: { lectureId: string; noteKey: string; aiText: string; session: LectureSession; save: (value: string | null) => Promise<boolean | undefined>; children?: ReactNode }) {
  const draftKey = noteKey === 'personal' ? `aha-lecture-personal-${lectureId}` : `aha-lecture-edit-${lectureId}-${noteKey}`
  const [draft, setDraft] = useState(() => readDraft(draftKey) ?? lectureNoteText(session, noteKey, aiText))
  const [editing, setEditing] = useState(() => readDraft(draftKey) !== null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const savingRef = useRef(false)
  const cancelBlur = useRef(false)
  const edited = session.noteEdits?.[noteKey] !== undefined
  const finish = async (value: string | null) => {
    if (savingRef.current) return
    savingRef.current = true; setSaving(true); setFailed(false)
    if (await save(value)) { storeDraft(draftKey, ''); setEditing(false) } else setFailed(true)
    savingRef.current = false; setSaving(false)
  }
  const start = () => { if (editing) return; setDraft(lectureNoteText(session, noteKey, aiText)); setEditing(true); cancelBlur.current = false }
  return <div className="notebook-editable" data-note-edit={noteKey} onDoubleClick={event => { event.stopPropagation(); start() }}>
    {editing ? <><textarea autoFocus aria-label={noteKey === 'summary' ? 'Edit lecture overview' : noteKey === 'personal' ? 'Your notes' : 'Edit section notes'} value={draft} readOnly={saving} rows={Math.max(2, Math.min(16, draft.split('\n').length + 1))} maxLength={noteKey === 'personal' ? 100000 : 40000} onChange={event => { setDraft(event.target.value); storeDraft(draftKey, event.target.value || '\n') }} onBlur={() => { if (!cancelBlur.current) void finish(draft) }} onKeyDown={event => {
      if (event.key === 'Escape') { cancelBlur.current = true; storeDraft(draftKey, ''); setEditing(false) }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void finish(draft) }
    }}/><span className="notebook-edit-hint" role="status">{saving ? 'Saving…' : failed ? 'Could not save. Draft kept.' : 'Click outside to save · Esc to cancel'}</span>{failed && <button type="button" onClick={() => void finish(draft)}>Retry save</button>}</>
    : <><div className="notebook-direct-text" tabIndex={0} aria-label="Double-click or press Enter to edit" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); start() } }}>
      {edited && !noteKey.startsWith('heading:') && !noteKey.startsWith('concept-title:') ? <NotebookLines points={lectureNoteText(session, noteKey, aiText).split('\n').filter(Boolean).map(text => ({ text, sourceIds: [] }))}/> : children ?? <p className={`lecture-summary${aiText ? '' : ' notebook-placeholder'}`}>{aiText || 'Double-click anywhere to add a thought, sketch or connection…'}</p>}
    </div>{edited && <div className="notebook-edit-actions"><button type="button" disabled={saving} onClick={() => void finish(null)}>Reset to original</button></div>}</>}
  </div>
}
