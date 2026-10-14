import { useEffect, useId, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import type { CaptureCapabilities, CaptureStatus } from '../../../shared/lecture-capture'
import { CaptureHTTPError, createCapturePairing, getCaptureCapabilities, getCapturePairing, retryCapturePairing, revokeCapturePairing } from './captureClient'
import { Camera, RotateCcw } from './Icons'
import { captureHealth } from './captureHealth'
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
  if (!code) return <p className="learning-muted">Open recorder</p>
  return <svg className="capture-pairing-qr" viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label="Scan this QR code with your phone camera to pair with this lecture" shapeRendering="crispEdges">
    <rect width={code.size} height={code.size} fill="#fff" />
    <path d={code.path} fill="#111" />
  </svg>
}

export default function CapturePairingPanel({ lectureId, autoPair = true }: { lectureId: string; autoPair?: boolean }) {
  const headingId = useId()
  const [capabilities, setCapabilities] = useState<CaptureCapabilities | null>(null)
  const [status, setStatus] = useState<CaptureStatus | null>(null)
  const [pairingUrl, setPairingUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const autoAttempted = useRef(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [lastStatusAt, setLastStatusAt] = useState(0)
  const generation = useRef(0)
  const revision = useRef(0)
  const acting = useRef(false)
  const linkPairingId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const currentGeneration = ++generation.current
    const controller = new AbortController()
    let refreshing = false
    setCapabilities(null)
    setStatus(null)
    setPairingUrl('')
    linkPairingId.current = undefined
    setError('')
    setPollError('')
    setBusy('')
    setLoading(true)
    setStatusLoaded(false)
    autoAttempted.current = false
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
        setStatusLoaded(true)
        setLastStatusAt(Date.now())
        setPollError('')
        if (next?.state !== 'waiting' || (linkPairingId.current && next.id !== linkPairingId.current)) setPairingUrl('')
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
    const interval = window.setInterval(() => { setNow(Date.now()); void refresh() }, 3000)
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

  useEffect(() => {
    if (state !== 'waiting' || pairingUrl || !capabilities?.publicOrigin) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(`aha-pairing-${lectureId}`) || 'null')
      if (saved?.id !== status?.id) return
      const url = new URL(saved.url)
      if (url.origin === capabilities.publicOrigin && url.pathname === '/capture' && /^#pair=[a-f0-9]{64}$/.test(url.hash)) { linkPairingId.current = saved.id; setPairingUrl(url.href) }
    } catch { /* A replacement QR remains available when tab storage is unavailable. */ }
  }, [state, status?.id, pairingUrl, capabilities?.publicOrigin, lectureId])

  const act = async (name: string, operation: (valid: () => boolean) => Promise<void>) => {
    if (acting.current) return
    acting.current = true
    revision.current++
    const currentGeneration = generation.current
    const valid = () => generation.current === currentGeneration
    setBusy(name)
    setError('')
    try { await operation(valid) }
    catch (reason) { if (valid()) setError(reason instanceof Error ? reason.message : 'Could not update phone capture. Please try again.') }
    finally { if (valid()) { acting.current = false; setBusy('') } }
  }

  const create = () => { void act('create', async valid => {
    let pairing
    try { pairing = await createCapturePairing(lectureId, status?.id ?? null) }
    catch (error) {
      if (error instanceof CaptureHTTPError && error.status === 409) {
        const latest = await getCapturePairing(lectureId)
        if (valid()) { setStatus(latest); setPairingUrl(''); setLastStatusAt(Date.now()) }
        return
      }
      throw error
    }
    if (!valid()) return
    setStatus(pairing.status)
    setLastStatusAt(Date.now())
    setNow(Date.now())
    const url = new URL(pairing.url)
    if (url.protocol !== 'https:' || !url.hash.startsWith('#pair=')) throw new Error('A trusted HTTPS pairing link is required. Check phone capture setup.')
    linkPairingId.current = pairing.status.id
    setPairingUrl(url.href)
    try { sessionStorage.setItem(`aha-pairing-${lectureId}`, JSON.stringify({ id: pairing.status.id, url: url.href })) } catch { /* QR still works until this tab closes. */ }
    setPollError('')
  }) }

  useEffect(() => {
    if (autoPair && !autoAttempted.current && !loading && statusLoaded && canPair && status === null) {
      autoAttempted.current = true
      create()
    }
  }, [autoPair, loading, statusLoaded, canPair, status])

  const failedItems = status?.items.filter(item => item.status === 'failed').slice(-3) ?? []
  const health = status?.notes ? captureHealth(status, 0, lastStatusAt, now) : null
  return <section className="learning-panel capture-pairing-panel" aria-labelledby={headingId}>
    {link && <a className="capture-qr-link" href={link} target="_blank" rel="noreferrer" aria-label="Open recording device page"><PairingQr url={link}/></a>}
    <div className="capture-pairing-content">
      <h2 id={headingId}><Camera size={18}/> {state === 'connected' ? 'Recording device' : 'Scan to record'}</h2>
      {loading && <p role="status">Preparing recording…</p>}
      {link && <p>Connect your device to Tailscale. Scan, then tap <strong>Start capture</strong>. Notes update below.</p>}
      {capabilities && !canPair && <p className="capture-pairing-unavailable">{capabilities.detail || 'Phone capture is unavailable. Configure the HTTPS capture address and extraction provider.'}</p>}
      {canPair && capabilities.detail && (!capabilities.photo || !capabilities.audio) && <p className="learning-muted">{capabilities.detail}</p>}
      {state && <div className={`capture-connection capture-connection-${state}`} role="status"><span aria-hidden="true"/>{state === 'waiting' ? 'Waiting for device' : state === 'connected' ? 'Device connected' : state === 'expired' ? 'QR expired' : 'Device disconnected'}</div>}
      {state === 'connected' && <p>Keep the recording device’s page open and screen awake.</p>}
      {state === 'waiting' && !link && !loading && <p>QR created in another tab. Replace it to scan here.</p>}
      {!loading && state !== 'connected' && !link && <button className="secondary-button" disabled={!!busy || !canPair} onClick={create}>{busy === 'create' ? 'Preparing QR…' : state === 'waiting' ? 'Replace QR code' : 'Show recording QR code'}</button>}
      {health && state === 'connected' && <p className="capture-notes-health" role="status">{health.title}</p>}
      {status && status.failed > 0 && <div className="capture-failures" role="alert"><p>{status.failed} recordings failed. Saved for retry.</p><ul>{failedItems.map(item => <li key={item.id}>{item.kind === 'photo' ? 'Photo' : 'Audio'}: {item.error || 'Processing failed.'}</li>)}</ul><button className="secondary-button" disabled={!!busy} onClick={() => { void act('retry', async valid => { const next = await retryCapturePairing(lectureId, status.id); if (valid()) setStatus(next) }) }}><RotateCcw size={14}/>{busy === 'retry' ? 'Retrying…' : 'Retry failed items'}</button></div>}
      {active && <button className="learning-text-button capture-revoke" disabled={!!busy} onClick={() => { void act('revoke', async valid => { await revokeCapturePairing(lectureId, status!.id); if (valid()) { setStatus({ ...status!, state: 'revoked' }); setPairingUrl('') } }) }}>{busy === 'revoke' ? 'Disconnecting…' : state === 'waiting' ? 'Cancel pairing' : 'Disconnect device'}</button>}
      {pollError && <p className="learning-error" role="status">{pollError}</p>}
      {error && <p className="learning-error" role="alert">{error} {!capabilities && <button onClick={() => setReload(value => value + 1)}>Try again</button>}</p>}
    </div>
  </section>
}
