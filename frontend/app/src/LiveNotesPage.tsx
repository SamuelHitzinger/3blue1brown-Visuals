import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LectureLiveSnapshot } from '../../../shared/lecture-view'
import { assignLectureConcepts, lectureNoteText, notebookSectionKey } from './lectureDocument'
import { watchLiveNotes } from './liveReader'
import type { LiveReaderCredentials, ReaderConnection } from './liveReader'
import ReaderVisual from './ReaderVisual'
import { createReaderModelCache } from './readerModels'
import type { ReaderModelCache } from './readerModels'
import './lecture-notebook.css'
import './live-reader.css'

export default function LiveNotesPage({ credentials }: { credentials: LiveReaderCredentials }) {
  const { id, token } = credentials
  const [snapshot, setSnapshot] = useState<LectureLiveSnapshot | null>(null)
  const [connection, setConnection] = useState<ReaderConnection>('connecting')
  const [reload, setReload] = useState(0)
  const [updates, setUpdates] = useState(0)
  const [suspended, setSuspended] = useState(document.hidden)
  const latest = useRef<LectureLiveSnapshot | null>(null)
  const scrollAnchor = useRef<{ element: HTMLElement; top: number } | null>(null)
  const [models, setModels] = useState<ReaderModelCache | null>(null)
  useEffect(() => {
    const cache = createReaderModelCache(id, token)
    setModels(cache)
    return () => cache.dispose()
  }, [id, token])
  useEffect(() => {
    if (!id || !token) return
    return watchLiveNotes(id, token, next => {
      if (latest.current && latest.current.revision >= next.revision) return
      // Keep the current paragraph or scene in place when earlier notes grow.
      const visible = [...document.querySelectorAll<HTMLElement>('.live-reader-paper p, .live-reader-paper li, .live-reader-paper h2, .live-reader-paper h3, .live-reader-paper .lecture-visual')]
        .find(element => { const rect = element.getBoundingClientRect(); return rect.bottom > 100 && rect.top < window.innerHeight })
      scrollAnchor.current = window.scrollY > 100 && visible ? { element: visible, top: visible.getBoundingClientRect().top } : null
      latest.current = next
      setSnapshot(next)
    }, setConnection)
  }, [id, token, reload])
  useLayoutEffect(() => {
    const anchor = scrollAnchor.current
    scrollAnchor.current = null
    if (anchor?.element.isConnected) window.scrollBy({ top: anchor.element.getBoundingClientRect().top - anchor.top, behavior: 'instant' })
  }, [snapshot])
  useEffect(() => { if (snapshot) setUpdates(value => value + 1) }, [snapshot?.revision])
  useEffect(() => {
    const visibility = () => setSuspended(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useEffect(() => { document.title = `${snapshot?.title ?? 'Live notes'} — Aha!` }, [snapshot?.title])
  const sections = snapshot?.notes ? assignLectureConcepts(snapshot.notes) : []
  const pending = snapshot?.status === 'queued' || snapshot?.status === 'processing'
  const lag = snapshot ? Math.max(0, snapshot.sourceRevision - snapshot.synthesizedRevision) : 0
  const invalid = !id || !token
  const status = invalid ? 'Reader link needed' : connection === 'connected' ? 'Connected · Updates automatically' : connection === 'unauthorized' ? 'Link expired or revoked' : connection === 'reconnecting' ? 'Connection lost · Reconnecting' : 'Connecting…'
  return <main className="live-reader lecture-notebook">
    <header className="live-reader-heading">
      <span className="learning-eyebrow">Aha! · Live lecture notes</span>
      <h1>{snapshot?.title ?? 'Your lecture, as it unfolds'}</h1>
      <div className={`live-reader-connection connection-${connection}`} role="status"><span aria-hidden="true"/>{status}</div>
      {snapshot && <div className="live-reader-meta"><span>{updates} {updates === 1 ? 'update' : 'updates'} received</span><span>Updated <time dateTime={snapshot.updatedAt}>{new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span></div>}
      {!invalid && connection !== 'connected' && <button className="secondary-button" onClick={() => setReload(value => value + 1)}>Reconnect</button>}
      {(invalid || connection === 'unauthorized') && <p className="live-reader-notice">Open a fresh live notes link from the lecture on your computer. {snapshot ? 'Your last received notes remain below.' : 'Scan its QR code with your iPad to begin.'}</p>}
      {connection === 'reconnecting' && snapshot && <p className="live-reader-notice">Your notes stay here while the connection returns.</p>}
    </header>
    {snapshot && <>
      <nav className="live-reader-nav" aria-label="Lecture sections">
        {snapshot.notes && <a href="#live-overview">Overview</a>}
        {sections.map(section => <a key={section.id} href={`#live-${notebookSectionKey(section.id)}`}>{section.title}</a>)}
        {!!snapshot.notes?.questions.length && <a href="#live-questions">Questions</a>}
        {snapshot.personalNotes && <a href="#live-personal">My notes</a>}
      </nav>
      <article className="notebook-paper live-reader-paper">
        {(pending || lag > 0) && <p className="live-reader-notice" role="status">{pending ? 'New material is being woven into your notes.' : 'New material is waiting for a notes update.'}{lag > 0 && ` Notes cover ${snapshot.synthesizedRevision} of ${snapshot.sourceRevision} material updates.`}</p>}
        {snapshot.status === 'failed' && <p className="learning-error" role="status">{snapshot.error || 'The latest notes update could not finish. Retry it from your computer.'}</p>}
        {snapshot.notes ? <div className="generated-notes">
          <section id="live-overview" className="notebook-section"><h2>Overview</h2><p className="notebook-edited-text lecture-summary">{lectureNoteText(snapshot, 'summary', snapshot.notes.summary)}</p></section>
          {sections.map(section => <section id={`live-${notebookSectionKey(section.id)}`} className="notebook-section" key={section.id}>
            <h2>{section.title}</h2>
            {snapshot.noteEdits?.[`section:${section.id}`] !== undefined ? <p className="notebook-edited-text">{lectureNoteText(snapshot, `section:${section.id}`, '')}</p> : <ul>{section.points.map((point, index) => <li key={index}>{point.text}</li>)}</ul>}
            {section.concepts.map(concept => {
              const visual = [...snapshot.visualizations].reverse().find(item => item.conceptId === concept.id)
              const visualPending = visual?.status === 'queued' || visual?.status === 'processing'
              return <figure className="notebook-figure" key={concept.id}>
                <figcaption><span className="learning-eyebrow">Visual explanation</span><h3>{concept.title}</h3></figcaption>
                <p className="concept-explanation">{concept.explanation}</p>
                {visual?.source ? <ReaderVisual key={visual.id} visualization={visual} models={models} suspended={suspended}/> : <p className="live-reader-notice">{visualPending ? 'Your visual explanation is taking shape…' : visual?.status === 'failed' ? 'This visual could not finish. Retry it from your computer.' : 'A visual will appear here when it is created on your computer.'}</p>}
                {visual?.source && visualPending && <p className="learning-muted">Updating this visual. The previous explanation is still playable.</p>}
                {visual?.source && visual.status === 'failed' && <p className="learning-muted">The visual update could not finish. The previous explanation is still playable.</p>}
                {visual && visual.sourceRevision < snapshot.sourceRevision && <p className="learning-muted">This visualization reflects earlier material.</p>}
              </figure>
            })}
          </section>)}
          {!!snapshot.notes.questions.length && <section id="live-questions" className="notebook-section"><h2>Questions to come back to</h2><ul>{snapshot.notes.questions.map((point, index) => <li key={index}>{point.text}</li>)}</ul></section>}
        </div> : <div className="live-reader-empty"><h2>Ready for the first ideas</h2><p>As your phone captures the lecture, notes will appear here after processing.</p></div>}
        {snapshot.personalNotes && <section id="live-personal" className="notebook-section live-reader-personal"><h2>My notes</h2><p className="notebook-edited-text">{snapshot.personalNotes}</p></section>}
      </article>
    </>}
    {!snapshot && !invalid && connection === 'connecting' && <p className="live-reader-empty" role="status">Opening your lecture notes…</p>}
    <footer className="live-reader-footer">Read along here. Capture on your phone, edit on your computer.</footer>
  </main>
}
