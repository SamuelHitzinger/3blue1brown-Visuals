import { useEffect, useRef, useState } from 'react'
import { getNoteInstructions, saveNoteInstructions } from './lectures'

export default function NoteInstructions() {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    setLoading(true)
    void getNoteInstructions(controller.signal).then(result => {
      if (!controller.signal.aborted) { setValue(result.instructions); setSaved(result.instructions); setError(''); setLoaded(true) }
    }).catch(() => { if (!controller.signal.aborted) setError('Instructions could not load.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { mounted.current = false; controller.abort() }
  }, [reload])
  const save = async () => {
    const draft = value
    setSaving(true); setError(''); setConfirmed(false)
    try { const result = await saveNoteInstructions(draft); if (mounted.current) { setSaved(result.instructions); setValue(result.instructions); setConfirmed(true) } }
    catch { if (mounted.current) setError('Instructions could not save. Please retry.') }
    finally { if (mounted.current) setSaving(false) }
  }
  return <section className="note-instructions" aria-labelledby="note-instructions-heading">
    <label id="note-instructions-heading" htmlFor="note-instructions-input">Note instructions <span>For all lectures</span></label>
    <textarea id="note-instructions-input" rows={2} maxLength={1000} disabled={!loaded || loading || saving} value={value} onChange={event => { setValue(event.target.value); setConfirmed(false) }} placeholder="e.g. Write in German. Keep notes shorter. Use fewer visuals." aria-describedby="note-instructions-help"/>
    <div className="note-instructions-footer"><p id="note-instructions-help">Language, length and visuals. Applies to future updates; use Update notes in a lecture to refresh it.</p><button className="secondary-button" disabled={!loaded || loading || saving || value.trim() === saved} onClick={() => void save()}>{loading ? 'Loading…' : saving ? 'Saving…' : 'Save instructions'}</button></div>
    {confirmed && <p className="learning-muted" role="status">Instructions saved for all lectures.</p>}
    {error && <p className="learning-error" role="alert">{error} <button className="learning-text-button" onClick={() => setReload(n => n + 1)}>Reload</button></p>}
  </section>
}
