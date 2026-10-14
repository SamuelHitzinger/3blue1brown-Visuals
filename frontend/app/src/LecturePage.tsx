import { useCallback, useEffect, useRef, useState } from 'react'
import type { LectureConcept, LectureSession } from '../../../shared/lecture'
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, Layers3, Plus, RotateCcw, Trash } from './Icons'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey } from './lectureDocument'
import type { CourseSubject } from './curriculum'
import type { ReactNode } from 'react'
import './lecture-notebook.css'
import LectureVisual from './LectureVisual'
import CapturePairingPanel from './CapturePairingPanel'
import ViewerLinkPanel from './ViewerLinkPanel'
import { appendLectureSource, deleteLecture, downloadLecture, finishLecture, hasLectureVisual, lectureStatus, mergeLectureSnapshot, patchLecture, sourceRequestKey, synthesizeLecture, visualizeConcept, watchLectureSnapshots } from './lectures'

function readDraft(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function storeDraft(key: string, value: string) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* The visible draft is retained for this session. */ } }

export default function LecturePage({ id, onBack, suspended, courses = [] }: { id: string; onBack: (courseId?: string) => void; suspended: boolean; courses?: CourseSubject[] }) {
  const [session, setSession] = useState<LectureSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [sourceText, setSourceText] = useState(() => readDraft(`aha-lecture-source-${id}`) ?? '')
  const [personalNotes, setPersonalNotes] = useState(() => readDraft(`aha-lecture-personal-${id}`) ?? '')
  const personalDirty = useRef(readDraft(`aha-lecture-personal-${id}`) !== null)
  const personalCurrent = useRef(personalNotes)
  personalCurrent.current = personalNotes
  const [noteSaved, setNoteSaved] = useState(false)
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [activeSection, setActiveSection] = useState('role-summary')
  const sourceDrawer = useRef<HTMLDetailsElement>(null)
  const [activeSource, setActiveSource] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const request = useRef<{ body: string; key: string }>({ body: '', key: crypto.randomUUID() })
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
  const openSource = (sourceId: string) => {
    setActiveSource(sourceId)
    if (sourceDrawer.current) sourceDrawer.current.open = true
    const source = document.getElementById(`lecture-source-${sourceId}`) as HTMLDetailsElement | null
    if (source) { source.open = true; source.scrollIntoView({ behavior: 'smooth', block: 'center' }); source.focus({ preventScroll: true }) }
  }
  const citations = (ids: string[]) => <span className="source-citations">{[...new Set(ids)].map(sourceId => { const source = session?.sources.find(item => item.id === sourceId); return source ? <button key={sourceId} onClick={() => openSource(sourceId)} aria-label={`Read source ${source.sequence}`}>{source.sequence}</button> : null })}</span>
  if (loading) return <main className="learning-page"><div className="learning-empty" role="status">Opening your lecture…</div></main>
  if (!session) return <main className="learning-page"><button className="learning-back" onClick={() => onBack()}><ArrowLeft size={16}/> All lectures</button><div className="learning-empty"><p role="alert">{loadError || 'This lecture is unavailable.'}</p><button className="secondary-button" onClick={() => { setLoading(true); setReload(value => value + 1) }}>Try again</button></div></main>
  const notesPending = session.status === 'queued' || session.status === 'processing'
  const sections = session.notes ? assignLectureConcepts(session.notes) : []
  const course = courses.find(item => item.id === session.courseId)
  const courseTitle = course?.title ?? (session.courseId ? `Course: ${session.courseId.replace(/[-_]/g, " ")}` : "Independent study")
  const visualize = (target: LectureConcept) => { void act('visualize', () => visualizeConcept(id, target.id)) }
  return <main className="learning-page lecture-detail-page lecture-notebook">
    <button className="learning-back" onClick={() => onBack(session.courseId ?? "__independent__")}><ArrowLeft size={16}/> {courseTitle}</button>
    <div className="lecture-heading"><div><span className="learning-eyebrow">{courseTitle} {'\u00b7'} Lecture notebook</span><EditableTitle title={session.title} busy={!!busy} save={title => act("title", () => patchLecture(id, { title }))}/><div className="lecture-heading-meta"><span className={`lecture-status status-${session.status}`}><span/>{lectureStatus(session)}</span><span>{session.sources.length} {session.sources.length === 1 ? 'source' : 'sources'}</span></div></div><button className="secondary-button" onClick={() => downloadLecture({ ...session, personalNotes })}><FileText size={16}/> Export notes</button></div>
    {(error || loadError) && <p className="learning-error" role="alert">{error || loadError} {loadError && <button onClick={() => setReload(value => value + 1)}>Reconnect</button>}</p>}
    <CapturePairingPanel key={id} lectureId={id} autoPair={!session.finishedAt}/>
    <div className="lecture-finish"><button className="secondary-button" disabled={!!busy || !!session.finishedAt || !!sourceText.trim()} onClick={() => { void act('finish', () => finishLecture(id)) }}><Check size={16}/>{session.finishedAt ? 'Finished' : busy === 'finish' ? 'Finishing…' : 'Finish lecture'}</button><p>{sourceText.trim() ? 'Add or clear your pending source text before finishing.' : session.finishedAt ? 'Any remaining uploads will still update your notes.' : session.titleMode === 'automatic' ? 'After recording, finish to add a subtitle from your notes.' : 'Finish when you are done. Your chosen title stays unchanged.'}</p></div>
    <details className="notebook-tools" ref={sourceDrawer}><summary>Source material & sharing <span>{session.sources.length} {session.sources.length === 1 ? 'source' : 'sources'}</span></summary><div className="notebook-tools-body">
        <section className="learning-panel source-composer" aria-labelledby="source-heading"><div className="learning-section-heading"><h2 id="source-heading">Add to the lecture</h2><Plus size={18}/></div><p>Paste a passage, a slide’s text, or what you just heard.</p>
          <div className="lecture-input-tabs" aria-label="Lecture input"><span><FileText size={14}/> Text</span><span>Use phone capture above for photos and audio.</span></div>
          <form onSubmit={event => { event.preventDefault(); const text = sourceText; if (!text.trim()) return; if (request.current.body !== text) request.current = { body: text, key: sourceRequestKey(localStorage, id, text) }; void act('source', () => appendLectureSource(id, text, request.current.key), () => { setSourceText(''); storeDraft(`aha-lecture-source-${id}`, ''); storeDraft(`aha-lecture-request-${id}`, ''); request.current = { body: '', key: crypto.randomUUID() } }) }}>
            <textarea aria-label="Lecture source text" rows={7} value={sourceText} maxLength={40000} disabled={busy === 'source'} placeholder="A linear transformation preserves addition and scaling…" onChange={event => { setSourceText(event.target.value); storeDraft(`aha-lecture-source-${id}`, event.target.value) }}/>
            <button className="primary-button" disabled={!!busy || !sourceText.trim()}>{busy === 'source' ? 'Saving material…' : 'Add material'}<ArrowRight size={16}/></button>
          </form><small>Notes update as you add material. Your original text stays here.</small>
        </section>
        <section className="source-history" aria-labelledby="source-history-heading"><div className="learning-section-heading"><h2 id="source-history-heading">Source history</h2><span>{session.sources.length}</span></div>{session.sources.length ? session.sources.map(source => <details key={source.id} id={`lecture-source-${source.id}`} tabIndex={-1} className={activeSource === source.id ? 'is-highlighted' : ''}><summary><span className="source-number">{source.sequence}</span><span>{source.text.replace(/\s+/g, ' ').slice(0, 58)}{source.text.length > 58 ? '…' : ''}</span></summary><p>{source.text}</p><small>{new Date(source.createdAt).toLocaleString()}</small></details>) : <p className="learning-muted">Every passage you add will appear here, in order.</p>}</section>
        <ViewerLinkPanel key={id} lectureId={id}/>
      </div></details>
      <SectionRail sections={[{ id: "role-summary", title: "Overview" }, ...sections.map(section => ({ id: notebookSectionKey(section.id), title: section.title })), ...(session.notes?.questions.length ? [{id:"role-questions",title:"Questions"}] : []), { id: "role-personal", title: "My notes" }]} active={activeSection} onActive={setActiveSection}/>
      <article className="lecture-main-column notebook-paper">
        <section className="learning-panel lecture-notes-panel" aria-labelledby="generated-notes-heading"><div className="learning-section-heading"><h2 id="generated-notes-heading"><BookOpen size={20}/> Lecture notes</h2>{session.sources.length > 0 && <button className="learning-text-button" disabled={!!busy || notesPending} onClick={() => { void act('synthesize', () => synthesizeLecture(id)) }}><RotateCcw size={14}/>{session.status === 'failed' ? 'Retry notes' : 'Update notes'}</button>}</div>
          {session.status === 'failed' && <p className="learning-error" role="alert">{session.error || 'The notes could not be updated. Your source material is saved.'}</p>}
          {notesPending && <p className="lecture-progress" role="status"><span className="working-dot"/>{session.notes ? 'Weaving the new material into your notes…' : 'Finding the connections in your material…'}</p>}
          {session.notes ? <div className="generated-notes"><section id="notebook-role-summary" data-notebook-section="role-summary" className="notebook-section"><h3>Overview</h3><EditableNote lectureId={id} noteKey="summary" aiText={session.notes.summary} session={session} busy={!!busy} save={value => act('edit-summary', () => patchLecture(id, { noteEdits: { summary: value } }))}/></section>{session.synthesizedRevision < session.sourceRevision && <p className="learning-muted">These notes cover earlier material. An update is {notesPending ? 'on its way' : 'needed'}.</p>}{sections.map(section => <section id={`notebook-${notebookSectionKey(section.id)}`} data-notebook-section={notebookSectionKey(section.id)} className="notebook-section" key={section.id}><h3>{section.title}</h3><EditableNote lectureId={id} noteKey={`section:${section.id}`} aiText={section.points.map(point => point.text).join('\n')} session={session} busy={!!busy} save={value => act('edit-section', () => patchLecture(id, { noteEdits: { [`section:${section.id}`]: value } }))}><ul>{section.points.map((point,index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></EditableNote>{section.concepts.map(concept => {
            const visual = [...session.visualizations].reverse().find(item => item.conceptId === concept.id)
            const visualPending = visual?.status === 'queued' || visual?.status === 'processing'
            return <figure className="notebook-figure" key={concept.id}><figcaption><span className="learning-eyebrow">Visual explanation</span><h4>{concept.title}</h4></figcaption>
          <p className="concept-explanation">{concept.explanation}{citations(concept.sourceIds)}</p>
          {hasLectureVisual(visual) ? <><LectureVisual key={visual.id} visualization={visual} suspended={suspended}/>{visualPending && <p className="lecture-progress" role="status"><span className="working-dot"/>Updating the visual. Your earlier explanation is still playable.</p>}{visual.status === 'failed' && <p className="learning-error" role="alert">{visual.error || 'The visual could not be updated.'} <button disabled={!!busy} onClick={() => visualize(concept)}>Retry update</button></p>}</> : <div className="concept-placeholder"><Layers3 size={32}/><h3>{visualPending ? 'Building your visual explanation' : visual?.status === 'failed' ? 'Let’s try that visual again' : 'Make this idea visible'}</h3><p>{visualPending ? 'You can keep adding material while the animation takes shape.' : visual?.error || 'Explore this concept through a focused, interactive animation.'}</p>{!visualPending && <button className="primary-button" disabled={!!busy} onClick={() => visualize(concept)}>{visual?.status === 'failed' ? 'Retry visualization' : 'Visualize concept'}<ArrowRight size={16}/></button>}</div>}
          {visual && visual.sourceRevision < session.sourceRevision && <div className="stale-visual-note"><span>This visualization reflects earlier material.</span>{!visualPending && <button disabled={!!busy} onClick={() => visualize(concept)}>Update visual</button>}</div>}
</figure>
          })}</section>)}{session.notes.questions.length > 0 && <section id="notebook-role-questions" data-notebook-section="role-questions" className="notebook-section"><h3>Questions to come back to</h3><ul>{session.notes.questions.map((point,index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></section>}</div> : !notesPending && <div className="learning-empty compact"><BookOpen size={33}/><h3>From material to meaning</h3><p>Scan the recording QR above, or add source text. Your notes will grow here.</p></div>}
        </section>
        <section id="notebook-role-personal" data-notebook-section="role-personal" className="learning-panel personal-notes-panel notebook-section" aria-labelledby="personal-heading"><div className="learning-section-heading"><h2 id="personal-heading">My notes</h2><span>{noteSaved ? <><Check size={13}/> Saved</> : personalDirty.current ? 'Unsaved changes' : 'Your own words'}</span></div><textarea aria-labelledby="personal-heading" rows={5} value={personalNotes} placeholder="A connection you made. A question to ask. Your own way of saying it." maxLength={100000} onChange={event => { personalDirty.current = true; setNoteSaved(false); setPersonalNotes(event.target.value); storeDraft(`aha-lecture-personal-${id}`, event.target.value || '\n') }}/><div className="personal-note-actions"><small>These notes stay yours when the lecture summary updates.</small><button className="secondary-button" disabled={!!busy || !personalDirty.current} onClick={() => { const draft = personalNotes; void act('personal', () => patchLecture(id, { personalNotes: draft }), () => { if (personalCurrent.current === draft) { personalDirty.current = false; storeDraft(`aha-lecture-personal-${id}`, ''); setNoteSaved(true) } }) }}>{busy === 'personal' ? 'Saving…' : 'Save my notes'}</button></div></section>
      </article>
    <div className="lecture-delete">{confirmDelete ? <div><span>Delete this lecture and all its material?</span><button className="learning-danger" disabled={!!busy} onClick={async () => { if (busyRef.current) return; busyRef.current = true; setBusy('delete'); try { await deleteLecture(id); storeDraft(`aha-lecture-source-${id}`, ''); storeDraft(`aha-lecture-personal-${id}`, ''); storeDraft(`aha-lecture-request-${id}`, ''); if (mounted.current) onBack(session.courseId ?? "__independent__") } catch (reason) { if (mounted.current) { setError(reason instanceof Error ? reason.message : 'Could not delete this lecture.'); setBusy('') }; busyRef.current = false } }}>Delete lecture</button><button onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button className="learning-muted" onClick={() => setConfirmDelete(true)}><Trash size={14}/> Delete lecture</button>}</div>
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
function SectionRail({ sections, active, onActive }: { sections: {id: string; title: string}[]; active: string; onActive: (id: string) => void }) {
  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('[data-notebook-section]')]
    if (!('IntersectionObserver' in window)) return
    const visible = new Set<HTMLElement>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) { if (entry.isIntersecting) visible.add(entry.target as HTMLElement); else visible.delete(entry.target as HTMLElement) }
      const first = elements.find(element => visible.has(element))
      if (first?.dataset.notebookSection) onActive(first.dataset.notebookSection)
    }, { rootMargin: '-15% 0px -55% 0px' })
    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [sections.map(section => section.id).join('|'), onActive])
  return <nav className="notebook-rail" aria-label="Lecture sections"><span>On this page</span><div>{sections.map(section => <a key={section.id} href={`#notebook-${section.id}`} title={section.title} aria-label={`Jump to ${section.title}`} aria-current={active === section.id ? 'location' : undefined} onClick={() => onActive(section.id)}><i/>{section.title}</a>)}</div></nav>
}
