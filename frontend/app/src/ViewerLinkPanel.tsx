import { useEffect, useId, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import type { LectureViewLink, LectureViewLinkStatus } from '../../../shared/lecture-view'
import { BookOpen } from './Icons'
import './live-reader.css'

function ReaderQr({ url }: { url: string }) {
  const code = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(url); qr.make()
    const size = qr.getModuleCount()
    const paths: string[] = []
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.isDark(y, x)) paths.push(`M${x + 4},${y + 4}h1v1h-1z`)
    return { size: size + 8, path: paths.join('') }
  }, [url])
  return <svg className="viewer-link-qr" viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label="Scan to open live lecture notes on another screen" shapeRendering="crispEdges"><rect width={code.size} height={code.size} fill="#fff"/><path d={code.path} fill="#111"/></svg>
}

async function requestLink<T>(id: string, method: 'GET' | 'POST' | 'DELETE', signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/lectures/${encodeURIComponent(id)}/view-link`, { method, signal, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : typeof body?.error === 'string' ? body.error : 'Could not update the live notes link. Please try again.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export default function ViewerLinkPanel({ lectureId }: { lectureId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [link, setLink] = useState<LectureViewLink | null>(null)
  const [status, setStatus] = useState<LectureViewLinkStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const acting = useRef(false)
  const mutation = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const panelId = useId()
  useEffect(() => {
    const request = new AbortController()
    controller.current = request
    const version = mutation.current
    void requestLink<LectureViewLinkStatus>(lectureId, 'GET', request.signal).then(next => { if (!request.signal.aborted && mutation.current === version) setStatus(next) }).catch(reason => { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not check the existing reader link.') }).finally(() => { if (!request.signal.aborted) setStatusLoading(false) })
    return () => request.abort()
  }, [lectureId])
  const act = async (method: 'POST' | 'DELETE') => {
    const request = controller.current
    if (!request || request.signal.aborted || acting.current) return
    acting.current = true; mutation.current++; setBusy(true); setError(''); setCopied(false)
    try {
      if (method === 'POST') {
        const next = await requestLink<LectureViewLink>(lectureId, method, request.signal)
        if (request.signal.aborted) return
        const url = new URL(next.url)
        if (url.protocol !== 'https:' || url.pathname !== `/live/${lectureId}` || !/^#token=[0-9a-f]{64}$/i.test(url.hash)) throw new Error('A private HTTPS reader address is needed. Check the Tailscale receiver setup.')
        setLink(next); setStatus({ active: true, expiresAt: next.expiresAt })
      } else {
        await requestLink(lectureId, method, request.signal)
        if (request.signal.aborted) return
        setLink(null); setStatus({ active: false })
      }
    } catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not update the live notes link.') }
    finally { if (!request.signal.aborted) { acting.current = false; setBusy(false) } }
  }
  const open = () => {
    setExpanded(value => !value)
  }
  const copy = async () => {
    if (!link) return
    try { await navigator.clipboard.writeText(link.url); if (!controller.current?.signal.aborted) setCopied(true) }
    catch { input.current?.select(); setError('Select and copy the link below. Clipboard access is unavailable.') }
  }
  return <section className="viewer-link-panel">
    <div className="viewer-link-intro"><div><strong>Read along on another screen</strong><p>Notes and visuals update as the lecture grows.</p></div><button className="primary-button" aria-expanded={expanded} aria-controls={panelId} onClick={open}><BookOpen size={17}/>Open live notes</button></div>
    {expanded && <div id={panelId} className="viewer-link-body">
      <p>Scan with your iPad camera, or open the link on another computer. Connect that device to the same Tailscale network.</p>
      {(busy || statusLoading) && <p role="status">{busy ? 'Updating your reader link…' : 'Checking your reader link…'}</p>}
      {link && <div className="viewer-link-share"><ReaderQr url={link.url}/><div><p>Anyone with this link on your private network can read this lecture until it expires or you revoke it.</p><p className="learning-muted">Expires {new Date(link.expiresAt).toLocaleString()}</p><label id={labelId}>Live notes link</label><input ref={input} aria-labelledby={labelId} readOnly value={link.url} spellCheck={false} onFocus={event => event.currentTarget.select()}/><div className="viewer-link-actions"><button className="secondary-button" onClick={() => { void copy() }}>{copied ? 'Link copied' : 'Copy link'}</button><a className="primary-button" href={link.url} target="_blank" rel="noopener noreferrer">Open reader</a></div></div></div>}
      {!link && !busy && !statusLoading && <><p className="learning-muted">{status?.active || !status ? 'Creating a new link disconnects any previous readers.' : 'Create a private, read-only link for this lecture.'}</p><button className="secondary-button" onClick={() => { void act('POST') }}>{status?.active || !status ? 'Replace reader link' : 'Create reader link'}</button></>}
      {(link || status?.active) && <button className="learning-text-button viewer-link-revoke" disabled={busy} onClick={() => { void act('DELETE') }}>Revoke reader link</button>}
      {error && <p className="learning-error" role="alert">{error}</p>}
    </div>}
  </section>
}
