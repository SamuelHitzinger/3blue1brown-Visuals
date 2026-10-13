import { useCallback, useEffect, useRef, useState } from 'react'
import type { LectureConcept, LectureSession } from '../../../shared/lecture'
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, FileText, Layers3, Plus, RotateCcw, Trash } from './Icons'
import LectureVisual from './LectureVisual'
import { appendLectureSource, deleteLecture, downloadLecture, getLecture, hasLectureVisual, lecturePending, lectureStatus, mergeLectureSnapshot, patchLecture, sourceRequestKey, synthesizeLecture, visualizeConcept } from './lectures'

function readDraft(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function storeDraft(key: string, value: string) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* The visible draft is retained for this session. */ } }

export default function LecturePage({ id, onBack, onCatalog, suspended }: { id: string; onBack: () => void; onCatalog: (id?: string) => void; suspended: boolean }) {
  const [session, setSession] = useState<LectureSession | null>(null)
  const current = useRef<LectureSession | null>(null)
  current.current = session
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
  const [selectedConcept, setSelectedConcept] = useState('')
  const [activeSource, setActiveSource] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const request = useRef<{ body: string; key: string }>({ body: '', key: crypto.randomUUID() })
  const mounted = useRef(true)
  const accept = useCallback((next: LectureSession) => setSession(previous => mergeLectureSnapshot(previous, next)), [])
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    let refreshing = false
    const refresh = async (force = false) => {
      if (refreshing || (!force && current.current && !lecturePending(current.current))) return
      refreshing = true
      try { const next = await getLecture(id, controller.signal); if (!controller.signal.aborted) { accept(next); setLoadError('') } }
      catch (reason) { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : 'Could not load your lecture.') }
      finally { refreshing = false; if (!controller.signal.aborted) setLoading(false) }
    }
    void refresh(true)
    const interval = setInterval(() => { void refresh() }, 2500)
    const focus = () => { void refresh(true) }
    window.addEventListener('focus', focus)
    return () => { mounted.current = false; controller.abort(); clearInterval(interval); window.removeEventListener('focus', focus) }
  }, [id, reload, accept])
  useEffect(() => {
    if (session && !personalDirty.current) setPersonalNotes(session.personalNotes)
  }, [session])
  useEffect(() => { if (session) document.title = `${session.title} — Aha!` }, [session?.title])
  const act = async (name: string, operation: () => Promise<LectureSession>, after?: (next: LectureSession) => void) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(name); setError('')
    try { const next = await operation(); if (mounted.current) { accept(next); after?.(next) } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.') }
    finally { busyRef.current = false; if (mounted.current) setBusy('') }
  }
  const openSource = (sourceId: string) => {
    setActiveSource(sourceId)
    const source = document.getElementById(`lecture-source-${sourceId}`) as HTMLDetailsElement | null
    if (source) { source.open = true; source.scrollIntoView({ behavior: 'smooth', block: 'center' }); source.focus({ preventScroll: true }) }
  }
  const citations = (ids: string[]) => <span className="source-citations">{[...new Set(ids)].map(sourceId => { const source = session?.sources.find(item => item.id === sourceId); return source ? <button key={sourceId} onClick={() => openSource(sourceId)} aria-label={`Read source ${source.sequence}`}>{source.sequence}</button> : null })}</span>
  if (loading) return <main className="learning-page"><div className="learning-empty" role="status">Opening your lecture…</div></main>
  if (!session) return <main className="learning-page"><button className="learning-back" onClick={onBack}><ArrowLeft size={16}/> All lectures</button><div className="learning-empty"><p role="alert">{loadError || 'This lecture is unavailable.'}</p><button className="secondary-button" onClick={() => { setLoading(true); setReload(value => value + 1) }}>Try again</button></div></main>
  const notesPending = session.status === 'queued' || session.status === 'processing'
  const concepts = session.notes?.concepts ?? []
  const concept = concepts.find(item => item.id === selectedConcept) ?? concepts[0]
  const visual = concept ? [...session.visualizations].reverse().find(item => item.conceptId === concept.id) : undefined
  const visualPending = visual?.status === 'queued' || visual?.status === 'processing'
  const visualize = (target: LectureConcept) => { void act('visualize', () => visualizeConcept(id, target.id)) }
  return <main className="learning-page lecture-detail-page">
    <button className="learning-back" onClick={onBack}><ArrowLeft size={16}/> All lectures</button>
    <div className="lecture-heading"><div><span className="learning-eyebrow">Lecture workspace</span><h1>{session.title}</h1><div className="lecture-heading-meta"><span className={`lecture-status status-${session.status}`}><span/>{lectureStatus(session)}</span><span>{session.sources.length} {session.sources.length === 1 ? 'source' : 'sources'}</span></div></div><button className="secondary-button" onClick={() => downloadLecture({ ...session, personalNotes })}><FileText size={16}/> Export notes</button></div>
    {(error || loadError) && <p className="learning-error" role="alert">{error || loadError} {loadError && <button onClick={() => setReload(value => value + 1)}>Reconnect</button>}</p>}
    <div className="lecture-workspace-grid">
      <aside className="lecture-source-column">
        <section className="learning-panel source-composer" aria-labelledby="source-heading"><div className="learning-section-heading"><h2 id="source-heading">Add to the lecture</h2><Plus size={18}/></div><p>Paste a passage, a slide’s text, or what you just heard.</p>
          <div className="lecture-input-tabs" aria-label="Lecture input"><button className="active" aria-pressed="true"><FileText size={14}/> Text</button><button disabled title="Camera input is coming later"><Camera size={14}/> Camera <small>Soon</small></button><button disabled title="Microphone input is coming later">Mic <small>Soon</small></button></div>
          <form onSubmit={event => { event.preventDefault(); const text = sourceText; if (!text.trim()) return; if (request.current.body !== text) request.current = { body: text, key: sourceRequestKey(localStorage, id, text) }; void act('source', () => appendLectureSource(id, text, request.current.key), () => { setSourceText(''); storeDraft(`aha-lecture-source-${id}`, ''); storeDraft(`aha-lecture-request-${id}`, ''); request.current = { body: '', key: crypto.randomUUID() } }) }}>
            <textarea aria-label="Lecture source text" rows={7} value={sourceText} maxLength={40000} disabled={busy === 'source'} placeholder="A linear transformation preserves addition and scaling…" onChange={event => { setSourceText(event.target.value); storeDraft(`aha-lecture-source-${id}`, event.target.value) }}/>
            <button className="primary-button" disabled={!!busy || !sourceText.trim()}>{busy === 'source' ? 'Saving material…' : 'Add material'}<ArrowRight size={16}/></button>
          </form><small>Notes update as you add material. Your original text stays here.</small>
        </section>
        <section className="source-history" aria-labelledby="source-history-heading"><div className="learning-section-heading"><h2 id="source-history-heading">Source history</h2><span>{session.sources.length}</span></div>{session.sources.length ? session.sources.map(source => <details key={source.id} id={`lecture-source-${source.id}`} tabIndex={-1} className={activeSource === source.id ? 'is-highlighted' : ''}><summary><span className="source-number">{source.sequence}</span><span>{source.text.replace(/\s+/g, ' ').slice(0, 58)}{source.text.length > 58 ? '…' : ''}</span></summary><p>{source.text}</p><small>{new Date(source.createdAt).toLocaleString()}</small></details>) : <p className="learning-muted">Every passage you add will appear here, in order.</p>}</section>
      </aside>
      <div className="lecture-main-column">
        <section className="learning-panel lecture-notes-panel" aria-labelledby="generated-notes-heading"><div className="learning-section-heading"><h2 id="generated-notes-heading"><BookOpen size={20}/> Lecture notes</h2>{session.sources.length > 0 && <button className="learning-text-button" disabled={!!busy || notesPending} onClick={() => { void act('synthesize', () => synthesizeLecture(id)) }}><RotateCcw size={14}/>{session.status === 'failed' ? 'Retry notes' : 'Update notes'}</button>}</div>
          {session.status === 'failed' && <p className="learning-error" role="alert">{session.error || 'The notes could not be updated. Your source material is saved.'}</p>}
          {notesPending && <p className="lecture-progress" role="status"><span className="working-dot"/>{session.notes ? 'Weaving the new material into your notes…' : 'Finding the connections in your material…'}</p>}
          {session.notes ? <div className="generated-notes"><p className="lecture-summary">{session.notes.summary}</p>{session.synthesizedRevision < session.sourceRevision && <p className="learning-muted">These notes cover earlier material. An update is {notesPending ? 'on its way' : 'needed'}.</p>}{session.notes.sections.map(section => <section key={section.id}><h3>{section.title}</h3><ul>{section.points.map((point, index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></section>)}{session.notes.questions.length > 0 && <section className="lecture-open-questions"><h3>Questions to come back to</h3><ul>{session.notes.questions.map((point, index) => <li key={index}>{point.text}{citations(point.sourceIds)}</li>)}</ul></section>}</div> : !notesPending && <div className="learning-empty compact"><BookOpen size={33}/><h3>From material to meaning</h3><p>Add your first passage. Your summary, key ideas, and questions will grow here.</p></div>}
        </section>
        <section className="learning-panel concept-panel" aria-labelledby="concept-heading"><div className="learning-section-heading"><h2 id="concept-heading"><Layers3 size={20}/> See the idea</h2><button className="learning-text-button" onClick={() => onCatalog()}>Explore catalog <ArrowRight size={14}/></button></div>{concept ? <>
          <div className="concept-tabs" role="group" aria-label="Lecture concepts">{concepts.map(item => <button key={item.id} className={concept.id === item.id ? 'active' : ''} aria-pressed={concept.id === item.id} onClick={() => setSelectedConcept(item.id)}>{item.title}</button>)}</div>
          <p className="concept-explanation">{concept.explanation}{citations(concept.sourceIds)}</p>
          {hasLectureVisual(visual) ? <><LectureVisual key={visual.id} visualization={visual} suspended={suspended}/>{visualPending && <p className="lecture-progress" role="status"><span className="working-dot"/>Updating the visual. Your earlier explanation is still playable.</p>}{visual.status === 'failed' && <p className="learning-error" role="alert">{visual.error || 'The visual could not be updated.'} <button disabled={!!busy} onClick={() => visualize(concept)}>Retry update</button></p>}</> : <div className="concept-placeholder"><Layers3 size={32}/><h3>{visualPending ? 'Building your visual explanation' : visual?.status === 'failed' ? 'Let’s try that visual again' : 'Make this idea visible'}</h3><p>{visualPending ? 'You can keep adding material while the animation takes shape.' : visual?.error || 'Explore this concept through a focused, interactive animation.'}</p>{!visualPending && <button className="primary-button" disabled={!!busy} onClick={() => visualize(concept)}>{visual?.status === 'failed' ? 'Retry visualization' : 'Visualize concept'}<ArrowRight size={16}/></button>}</div>}
          {visual && visual.sourceRevision < session.sourceRevision && <div className="stale-visual-note"><span>This visualization reflects earlier material.</span>{!visualPending && <button disabled={!!busy} onClick={() => visualize(concept)}>Update visual</button>}</div>}
          {concept.catalogIds.length > 0 && <div className="concept-catalog-links"><span>Explore the building blocks</span>{concept.catalogIds.map(catalogId => <button key={catalogId} onClick={() => onCatalog(catalogId)}>{catalogId.replace(/[-_]/g, ' ')}<ArrowRight size={12}/></button>)}</div>}
        </> : <div className="learning-empty compact"><Layers3 size={34}/><h3>A different way to understand</h3><p>Concepts from your lecture will become visual explanations you can play and explore.</p></div>}</section>
        <section className="learning-panel personal-notes-panel" aria-labelledby="personal-heading"><div className="learning-section-heading"><h2 id="personal-heading">My notes</h2><span>{noteSaved ? <><Check size={13}/> Saved</> : personalDirty.current ? 'Unsaved changes' : 'Your own words'}</span></div><textarea aria-labelledby="personal-heading" rows={5} value={personalNotes} placeholder="A connection you made. A question to ask. Your own way of saying it." maxLength={100000} onChange={event => { personalDirty.current = true; setNoteSaved(false); setPersonalNotes(event.target.value); storeDraft(`aha-lecture-personal-${id}`, event.target.value || '\n') }}/><div className="personal-note-actions"><small>These notes stay yours when the lecture summary updates.</small><button className="secondary-button" disabled={!!busy || !personalDirty.current} onClick={() => { const draft = personalNotes; void act('personal', () => patchLecture(id, { personalNotes: draft }), () => { if (personalCurrent.current === draft) { personalDirty.current = false; storeDraft(`aha-lecture-personal-${id}`, ''); setNoteSaved(true) } }) }}>{busy === 'personal' ? 'Saving…' : 'Save my notes'}</button></div></section>
      </div>
    </div>
    <div className="lecture-delete">{confirmDelete ? <div><span>Delete this lecture and all its material?</span><button className="learning-danger" disabled={!!busy} onClick={async () => { if (busyRef.current) return; busyRef.current = true; setBusy('delete'); try { await deleteLecture(id); storeDraft(`aha-lecture-source-${id}`, ''); storeDraft(`aha-lecture-personal-${id}`, ''); storeDraft(`aha-lecture-request-${id}`, ''); if (mounted.current) onBack() } catch (reason) { if (mounted.current) { setError(reason instanceof Error ? reason.message : 'Could not delete this lecture.'); setBusy('') }; busyRef.current = false } }}>Delete lecture</button><button onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button className="learning-muted" onClick={() => setConfirmDelete(true)}><Trash size={14}/> Delete lecture</button>}</div>
  </main>
}
