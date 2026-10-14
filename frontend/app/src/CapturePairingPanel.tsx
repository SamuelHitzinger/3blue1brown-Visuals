import { useEffect, useId, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import type { CaptureCapabilities, CaptureStatus } from '../../../shared/lecture-capture'
import { createCapturePairing, getCaptureCapabilities, getCapturePairing, retryCapturePairing, revokeCapturePairing } from './captureClient'
import { Camera, Check, RotateCcw } from './Icons'
import './capture-pairing.css'

function PairingQr({ url }: { url: string }) {
  const code = useMemo(() => {
    try {
      const qr = qrcode(0, 'M')
      qr.addData(url)
      qr.make()
      const size = qr.getModuleCount()
      const paths: string[] = []
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (qr.isDark(row, col)) paths.push(`M${col + 4},${row + 4}h1v1h-1z`)
        }
      }
      return { size: size + 8, path: paths.join('') }
    } catch { return null }
  }, [url])
  if (!code) return <p className="learning-muted">Use the pairing link below to connect your phone.</p>
  return <svg className="capture-pairing-qr" viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label="Scan this QR code with your phone camera to pair with this lecture" shapeRendering="crispEdges">
    <rect width={code.size} height={code.size} fill="#fff" />
    <path d={code.path} fill="#111" />
  </svg>
}

function CaptureTime({ value }: { value?: string }) {
  return value ? <time dateTime={value} title={new Date(value).toLocaleString()}>{new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time> : <span>None yet</span>
}

export default function CapturePairingPanel({ lectureId }: { lectureId: string }) {
  const headingId = useId()
  const linkId = useId()
  const [capabilities, setCapabilities] = useState<CaptureCapabilities | null>(null)
  const [status, setStatus] = useState<CaptureStatus | null>(null)
  const [pairingUrl, setPairingUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [copied, setCopied] = useState(false)
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(Date.now)
  const generation = useRef(0)
  const revision = useRef(0)
  const acting = useRef(false)
  const linkInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const currentGeneration = ++generation.current
    const controller = new AbortController()
    let refreshing = false
    setCapabilities(null)
    setStatus(null)
    setPairingUrl('')
    setError('')
    setPollError('')
    setCopied(false)
    setBusy('')
    setLoading(true)
    acting.current = false
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || refreshing || acting.current) return
      refreshing = true
      setNow(Date.now())
      const currentRevision = revision.current
      try {
        const next = await getCapturePairing(lectureId, controller.signal)
        if (controller.signal.aborted || revision.current !== currentRevision) return
        setStatus(next)
        setPollError('')
        if (next?.state !== 'waiting') setPairingUrl('')
      } catch {
        if (!controller.signal.aborted && revision.current === currentRevision) setPollError('Could not refresh phone status. Reconnecting automatically…')
      } finally {
        refreshing = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void getCaptureCapabilities(controller.signal).then((next: CaptureCapabilities) => {
      if (!controller.signal.aborted) setCapabilities(next)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not check phone capture availability. Please try again.')
    })
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 3000)
    const focus = () => { void refresh() }
    document.addEventListener('visibilitychange', focus)
    window.addEventListener('focus', focus)
    return () => {
      if (generation.current === currentGeneration) generation.current++
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', focus)
      window.removeEventListener('focus', focus)
    }
  }, [lectureId, reload])

  const expired = !!status && Date.parse(status.expiresAt) <= now
  const state = status ? expired && status.state !== 'revoked' ? 'expired' : status.state : null
  const active = state === 'waiting' || state === 'connected'
  const canPair = capabilities?.available && (capabilities.photo || capabilities.audio)
  const link = state === 'waiting' ? pairingUrl : ''

  const act = async (name: string, operation: (valid: () => boolean) => Promise<void>) => {
    if (acting.current) return
    acting.current = true
    revision.current++
    const currentGeneration = generation.current
    const valid = () => generation.current === currentGeneration
    setBusy(name)
    setError('')
    setCopied(false)
    try { await operation(valid) }
    catch (reason) { if (valid()) setError(reason instanceof Error ? reason.message : 'Could not update phone capture. Please try again.') }
    finally { if (valid()) { acting.current = false; setBusy('') } }
  }

  const create = () => { void act('create', async valid => {
    if (status?.state === 'waiting') {
      await revokeCapturePairing(lectureId, status.id)
      if (!valid()) return
      setStatus({ ...status, state: 'revoked' })
      setPairingUrl('')
    }
    const pairing = await createCapturePairing(lectureId)
    if (!valid()) return
    setStatus(pairing.status)
    setNow(Date.now())
    const url = new URL(pairing.url)
    if (url.protocol !== 'https:' || !url.hash.startsWith('#pair=')) throw new Error('A trusted HTTPS pairing link is required. Check phone capture setup.')
    setPairingUrl(url.href)
    setPollError('')
  }) }

  const copy = async () => {
    const currentGeneration = generation.current
    try {
      await navigator.clipboard.writeText(link)
      if (generation.current === currentGeneration) setCopied(true)
    } catch {
      if (generation.current === currentGeneration) {
        linkInput.current?.select()
        setError('Copy is unavailable in this browser. Select and copy the pairing link below.')
      }
    }
  }

  const failedItems = status?.items.filter(item => item.status === 'failed').slice(-3) ?? []
  const received = status ? status.pending + status.processed + status.skipped + status.failed : 0

  return <section className="learning-panel capture-pairing-panel" aria-labelledby={headingId}>
    <div className="learning-section-heading"><h2 id={headingId}><Camera size={18} /> Connect your phone</h2></div>
    <p className="capture-pairing-intro">Turn lecture photos and speech into material for your notes.</p>
    {loading && <p className="learning-muted" role="status">Checking phone connection…</p>}
    {capabilities && !canPair && <p className="capture-pairing-unavailable">{capabilities.detail || 'Phone capture is unavailable. Configure a trusted HTTPS capture address and an extraction provider to enable it.'}</p>}
    {canPair && <p className="capture-pairing-modes">{capabilities.photo ? 'Photos enabled' : 'Photos unavailable'} <span aria-hidden="true">·</span> {capabilities.audio ? 'Audio enabled' : 'Audio unavailable'}</p>}
    {canPair && capabilities.detail && (!capabilities.photo || !capabilities.audio) && <p className="learning-muted">{capabilities.detail}</p>}
    {state && <div className={`capture-connection capture-connection-${state}`} role="status"><span aria-hidden="true" />{state === 'waiting' ? 'Waiting for your phone' : state === 'connected' ? 'Phone connected' : state === 'expired' ? 'Pairing expired' : 'Phone disconnected'}</div>}
    {link && <div className="capture-pairing-link">
      <PairingQr url={link} />
      <p>Scan with your phone camera, then tap Start on your phone. Keep the capture page open while recording.</p>
      <small>One-use link · Expires <CaptureTime value={status?.expiresAt} /></small>
      <label htmlFor={linkId}>Pairing link</label>
      <input ref={linkInput} id={linkId} type="text" value={link} readOnly spellCheck={false} onFocus={event => event.currentTarget.select()} />
      <button className="secondary-button" onClick={() => { void copy() }}>{copied && <Check size={14} />}{copied ? 'Link copied' : 'Copy link'}</button>
    </div>}
    {state === 'waiting' && !link && !loading && <p className="learning-muted">The previous link is kept only in the tab that created it. Create a new link to pair here.</p>}
    {state === 'connected' && <p className="learning-muted">Pause or stop capture on your phone. Keep its screen awake and capture page visible.</p>}
    {!loading && state !== 'connected' && !link && <button className="primary-button" disabled={!!busy || !canPair} onClick={create}>{busy === 'create' ? 'Creating pairing…' : state === 'waiting' ? 'Replace pairing link' : 'Pair a phone'}</button>}
    {status && <div className="capture-receipts">
      <div className="capture-receipts-heading"><strong>{received} received</strong><span>Media items</span></div>
      <dl className="capture-counts">
        <div><dt>In progress</dt><dd>{status.pending}</dd></div>
        <div><dt>Ready</dt><dd>{status.processed}</dd></div>
        <div><dt>Skipped</dt><dd>{status.skipped}</dd></div>
        <div><dt>Failed</dt><dd>{status.failed}</dd></div>
      </dl>
      <dl className="capture-latest"><div><dt>Last photo</dt><dd><CaptureTime value={status.lastPhotoAt} /></dd></div><div><dt>Last audio</dt><dd><CaptureTime value={status.lastAudioAt} /></dd></div><div><dt>Phone last seen</dt><dd><CaptureTime value={status.lastSeenAt} /></dd></div></dl>
      {status.skipped > 0 && <p className="learning-muted">Skipped items contained no usable lecture material.</p>}
      {status.failed > 0 && <div className="capture-failures"><p>Failed items are retained for another attempt.</p>{failedItems.length > 0 && <ul>{failedItems.map(item => <li key={item.id}>{item.kind === 'photo' ? 'Photo' : 'Audio'}: {item.error || 'Extraction could not finish.'}</li>)}</ul>}<button className="secondary-button" disabled={!!busy} onClick={() => { void act('retry', async valid => { const next = await retryCapturePairing(lectureId, status.id); if (valid()) setStatus(next) }) }}><RotateCcw size={14} />{busy === 'retry' ? 'Retrying…' : 'Retry failed items'}</button></div>}
    </div>}
    {active && <button className="learning-text-button capture-revoke" disabled={!!busy} onClick={() => { void act('revoke', async valid => { await revokeCapturePairing(lectureId, status!.id); if (valid()) { setStatus({ ...status!, state: 'revoked' }); setPairingUrl('') } }) }}>{busy === 'revoke' ? 'Disconnecting…' : state === 'waiting' ? 'Revoke pairing link' : 'Disconnect phone'}</button>}
    {pollError && <p className="learning-muted" role="status">{pollError}</p>}
    {error && <p className="learning-error" role="alert">{error} {!capabilities && <button onClick={() => setReload(value => value + 1)}>Try again</button>}</p>}
  </section>
}
