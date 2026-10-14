import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureCapabilities, CaptureClaim } from '../../../shared/lecture-capture'
import { Camera, Check, Pause, Play, RotateCcw } from './Icons'
import { CaptureHTTPError, claimCapture, claimStorageKey, forgetCaptureClaim, getCaptureStatus, getDeviceCaptureCapabilities, prepareCaptureClaim, readCaptureClaim, retryCaptureItem, saveCaptureClaim, uploadCapture } from './captureClient'
import { CaptureQueue, IndexedCaptureStore } from './captureQueue'
import type { QueueSnapshot } from './captureQueue'
import { CaptureEngine, pauseWhenHidden } from './captureEngine'
import type { CaptureZoom } from './captureEngine'
import './capture.css'

const emptyQueue: QueueSnapshot = { pending: 0, bytes: 0, unsaved: 0, uploading: false, blocked: false, message: '', maxSequence: 0 }
const sequenceKey = (id: string) => `aha-capture-sequence-${id}`
const message = (error: unknown) => error instanceof Error ? error.message : 'Something interrupted capture. Please try again.'

export default function CapturePage() {
  const [claim, setClaim] = useState<CaptureClaim | null>(null)
  const [capabilities, setCapabilities] = useState<CaptureCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [queueState, setQueueState] = useState(emptyQueue)
  const [storageReady, setStorageReady] = useState(false)
  const [state, setState] = useState<'ready' | 'starting' | 'recording' | 'stopping' | 'paused'>('ready')
  const [note, setNote] = useState('')
  const [audio, setAudio] = useState(true)
  const [photo, setPhoto] = useState(true)
  const [interval, setIntervalValue] = useState(30)
  const [skipped, setSkipped] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [wakeActive, setWakeActive] = useState(false)
  const [retrying, setRetrying] = useState('')
  const [zoom, setZoom] = useState<CaptureZoom | null>(null)
  const [zoomValue, setZoomValue] = useState(1)
  const [previewRatio, setPreviewRatio] = useState('4 / 3')
  const [takingPhoto, setTakingPhoto] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const engine = useRef<CaptureEngine | null>(null)
  const queue = useRef<CaptureQueue | null>(null)
  const sequence = useRef(0)
  const mounted = useRef(false)
  const wake = useRef<WakeLockSentinel | null>(null)
  const busy = useRef(false)
  const started = useRef(0)
  const stop = useCallback(async (reason = 'Capture paused. Your queued material will continue uploading.') => {
    const capture = engine.current, lock = wake.current
    wake.current = null
    if (mounted.current) { setState('stopping'); setNote(reason) }
    await capture?.stop()
    await lock?.release().catch(() => {})
    if (engine.current !== capture) return
    busy.current = false
    if (mounted.current) { setWakeActive(false); setState('paused') }
  }, [])

  useEffect(() => {
    mounted.current = true
    document.title = 'Phone capture — Aha!'
    return () => { mounted.current = false; void engine.current?.stop(); void wake.current?.release().catch(() => {}) }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true); setError('')
    const connect = async () => {
      const caps = await getDeviceCaptureCapabilities(controller.signal)
      if (!active) return
      setCapabilities(caps); setAudio(caps.audio); setPhoto(caps.photo)
      const fragment = new URLSearchParams(location.hash.slice(1)).get('pair')
      let pending: { secret?: string } | null = null
      try { pending = JSON.parse(localStorage.getItem(claimStorageKey) || 'null') } catch { /* The visible fragment can repair this record. */ }
      const secret = fragment ?? pending?.secret
      const saved = readCaptureClaim(localStorage)
      let next: CaptureClaim
      if (secret) {
        const input = prepareCaptureClaim(localStorage, secret)
        next = await claimCapture(input.secret, input.deviceToken)
        if (!active) return
        saveCaptureClaim(localStorage, next)
        history.replaceState({}, '', '/capture')
        if (saved && saved.pairingId !== next.status.id) {
          const previous = new IndexedCaptureStore(saved.pairingId)
          try { const items = await previous.list(); if (active && items.length) setNote(`${items.length} unsent items from the previous pairing remain stored on this phone. They cannot upload through this new pairing. Keep this browser’s data to retain them.`) }
          catch { /* Existing material is never deleted when changing pairings. */ }
          finally { previous.close() }
        }
      } else {
        if (!saved) throw new Error('Scan the pairing code from a lecture on your computer to connect this phone.')
        try { next = { token: saved.token, status: await getCaptureStatus(saved.token, controller.signal) } }
        catch (error) { if (error instanceof CaptureHTTPError && [401, 403, 404, 410].includes(error.status)) forgetCaptureClaim(localStorage, saved.pairingId); throw error }
      }
      if (active) setClaim(next)
    }
    void connect().catch(error => { if (active) setError(message(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [reload])

  useEffect(() => {
    if (!claim) return
    let active = true, refreshing = false
    const controller = new AbortController()
    const store = new IndexedCaptureStore(claim.status.id)
    setStorageReady(false)
    const sender = new CaptureQueue(store, item => uploadCapture(claim.token, item, AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])), state => {
      if (!active) return
      setQueueState(state)
      if (state.blocked || state.unsaved) void stop(state.unsaved ? 'Storage is full. Keep this page open so the final material can upload.' : state.message)
    })
    queue.current = sender
    void sender.restore().then(() => {
      if (!active) return
      sequence.current = Math.max(Number(localStorage.getItem(sequenceKey(claim.status.id))) || 0, sender.snapshot().maxSequence)
      setStorageReady(true); void sender.flush()
    }).catch(error => { if (active) setError(message(error)) })
    const refresh = async () => {
      if (!active || refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      void sender.flush()
      try {
        const status = await getCaptureStatus(claim.token, controller.signal)
        if (!active) return
        setClaim(current => current?.status.id === status.id ? { ...current, status } : current)
        if (status.state === 'expired' || status.state === 'revoked') { forgetCaptureClaim(localStorage, status.id); void stop('This pairing has ended. Create a new pairing on your computer.') }
      } catch (error) {
        if (active && error instanceof CaptureHTTPError && [401, 403, 404, 410].includes(error.status)) {
          forgetCaptureClaim(localStorage, claim.status.id)
          setClaim(current => current ? { ...current, status: { ...current.status, state: 'revoked' } } : current)
          void stop('This pairing has ended. Create a new pairing on your computer.')
        }
      } finally { refreshing = false }
    }
    const timer = window.setInterval(() => { void refresh() }, 3000)
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', visible)
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false; clearInterval(timer)
      window.removeEventListener('online', visible); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible)
      // Preserve final recorder output before closing IndexedDB, including navigation cleanup.
      void (engine.current?.stop() ?? Promise.resolve()).finally(() => { sender.dispose(); controller.abort(); store.close() })
    }
  }, [claim?.token, stop])
  useEffect(() => {
    const remove = pauseWhenHidden(document, () => { if (busy.current) void stop('Capture paused because this page was hidden. Return here and tap Start to continue.') })
    const leaving = () => { if (busy.current) void stop('Capture paused.') }
    const unload = (event: BeforeUnloadEvent) => { if (busy.current || queue.current?.snapshot().unsaved) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('pagehide', leaving); window.addEventListener('beforeunload', unload)
    return () => { remove(); window.removeEventListener('pagehide', leaving); window.removeEventListener('beforeunload', unload) }
  }, [stop])
  useEffect(() => {
    if (state !== 'recording') return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [state])

  const start = async () => {
    if (busy.current || !claim || !video.current || !queue.current || !storageReady) return
    busy.current = true; setState('starting'); setError(''); setNote('')
    const sender = queue.current
    const capture = new CaptureEngine({
      video: video.current, audio, photo, photoIntervalMs: interval * 1000,
      canCapture: () => sender.hasCapacity(),
      onPaused: reason => { void stop(reason) },
      onSkipped: () => { if (mounted.current) setSkipped(value => value + 1) },
      onZoomChanged: value => { if (mounted.current && engine.current === capture) { setZoom(value); setZoomValue(value.value) } },
      onMedia: async media => {
        sequence.current++
        try { localStorage.setItem(sequenceKey(claim.status.id), String(sequence.current)) } catch { /* Durable queue metadata also restores the sequence. */ }
        const item = { pairingId: claim.status.id, blob: media.blob, metadata: { clientId: crypto.randomUUID(), sequence: sequence.current, kind: media.kind, capturedAt: media.capturedAt, ...(media.durationMs === undefined ? {} : { durationMs: media.durationMs }) } }
        try { await sender.enqueue(item) } finally { void sender.flush() }
      },
    })
    engine.current = capture
    try {
      if (!sender.hasCapacity()) throw new Error('Wait for queued material to upload before starting again.')
      const running = await capture.start()
      if (engine.current !== capture) { await capture.stop(); return }
      if (!running || !mounted.current || document.visibilityState !== 'visible') { await stop(); return }
      if (photo && zoomValue !== 1) await capture.setZoom(zoomValue).catch(error => { if (mounted.current) setError(message(error)) })
      if (engine.current !== capture) { await capture.stop(); return }
      if (!busy.current || !mounted.current || document.visibilityState !== 'visible') { await stop(); return }
      started.current = Date.now(); setElapsed(0); setState('recording')
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen')
          if (engine.current !== capture || !busy.current || !mounted.current || document.visibilityState !== 'visible') { await lock.release(); return }
          wake.current = lock; setWakeActive(true)
          lock.addEventListener('release', () => { if (mounted.current) setWakeActive(false) }, { once: true })
        } catch { /* The foreground reminder stays visible without wake lock. */ }
      }
    } catch (error) {
      await capture.stop()
      if (engine.current !== capture) return
      busy.current = false
      if (mounted.current) { setState('paused'); setError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Allow camera and microphone access in Safari settings, then tap Start again.' : message(error)) }
    }
  }
  const ended = claim?.status.state === 'revoked' || claim?.status.state === 'expired'
  const active = state === 'recording' || state === 'starting' || state === 'stopping'
  const changeZoom = (value: number) => {
    setZoomValue(value)
    const capture = engine.current
    void capture?.setZoom(value).catch(error => { if (mounted.current && engine.current === capture) { setError(message(error)); setZoomValue(zoom?.value ?? 1) } })
  }
  const snap = async () => {
    if (takingPhoto || state !== 'recording') return
    setTakingPhoto(true)
    try { await engine.current?.takePhoto() } finally { if (mounted.current) setTakingPhoto(false) }
  }
  return <main className="capture-page">
    <header className="capture-heading"><span className="wordmark">Aha!</span><span>Phone capture</span></header>
    <div className="capture-intro"><h1>{claim?.status.title ?? 'Connect your phone'}</h1><p>Point at the slides. Follow your live notes on your iPad or computer.</p></div>
    {loading && <p className="capture-notice" role="status">Connecting to your lecture…</p>}
    {error && <div className="capture-notice capture-error" role="alert"><p>{error}</p>{!claim && <button className="secondary-button" onClick={() => setReload(value => value + 1)}>Try connecting again</button>}</div>}
    {claim && <>
      <section className="capture-preview" aria-label="Camera and recording status" style={{ aspectRatio: previewRatio }}>
        <video ref={video} muted playsInline aria-label="Rear camera preview" style={{ transform: `scale(${zoom?.digitalScale ?? 1})` }} onLoadedMetadata={event => { const camera = event.currentTarget; if (camera.videoWidth && camera.videoHeight) setPreviewRatio(`${camera.videoWidth} / ${camera.videoHeight}`) }} onResize={event => { const camera = event.currentTarget; if (camera.videoWidth && camera.videoHeight) setPreviewRatio(`${camera.videoWidth} / ${camera.videoHeight}`) }} className={!photo || state !== 'recording' ? 'capture-preview-inactive' : ''}/>
        {state !== 'recording' && <div className="capture-preview-placeholder"><Camera size={38}/><p>{state === 'starting' ? 'Allow camera and microphone access…' : state === 'stopping' ? 'Saving the final clip…' : ended ? 'Pairing ended' : 'Ready when you are'}</p></div>}
        {state === 'recording' && !photo && <div className="capture-preview-placeholder"><span className="capture-mic-glyph">◉</span><p>Listening to your lecture</p></div>}
        <div className={`capture-live-status ${state === 'recording' ? 'is-recording' : ''}`} role="status"><span/>{state === 'recording' ? `${audio ? 'Recording' : 'Taking photos'} · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : state === 'starting' ? 'Opening devices' : state === 'stopping' ? 'Finishing' : 'Paused'}</div>
      </section>
      {photo && <section className="capture-zoom" aria-label="Camera zoom">
        <div className="capture-zoom-heading"><label htmlFor="capture-zoom">Zoom <strong>{Number(zoomValue.toFixed(1))}×</strong></label><span>{!zoom ? 'Available while recording' : zoom.mode === 'camera' ? 'Camera zoom' : 'Digital crop'}</span></div>
        <input id="capture-zoom" type="range" min={zoom?.min ?? 1} max={zoom?.max ?? 4} step={zoom?.step ?? .1} value={zoomValue} disabled={state !== 'recording'} onChange={event => changeZoom(Number(event.target.value))}/>
        <div className="capture-zoom-presets">{[1, 2, 3].filter(value => value >= (zoom?.min ?? 1) && value <= (zoom?.max ?? 4)).map(value => <button key={value} type="button" aria-pressed={Math.abs(zoomValue - value) < .05} disabled={state !== 'recording'} onClick={() => changeZoom(value)}>{value}×</button>)}</div>
      </section>}
      {note && <p className="capture-notice" role="status">{note}</p>}
      {queueState.message && <div className="capture-notice capture-error" role="alert"><p>{queueState.message}</p>{!ended && <button className="secondary-button" onClick={() => { void queue.current?.retry() }}>Retry uploads</button>}</div>}
      {queueState.unsaved > 0 && <p className="capture-notice capture-error" role="alert">Keep this tab open: {queueState.unsaved} final {queueState.unsaved === 1 ? 'item is' : 'items are'} held in memory because phone storage is full.</p>}
      <details className="capture-receipts"><summary><span><Check size={15}/> {queueState.uploading ? 'Uploading…' : queueState.pending ? `${queueState.pending} waiting to upload` : 'Uploads up to date'}</span><span>{claim.status.processed} saved</span></summary><div className="capture-details-body"><div className="capture-counts"><div><strong>{queueState.pending}</strong><span>On this phone</span></div><div><strong>{claim.status.pending}</strong><span>Processing</span></div><div><strong>{claim.status.processed}</strong><span>Text saved</span></div></div><p>{queueState.pending ? 'Queued material is retained until accepted.' : 'All captured material has been sent.'}</p><small>{skipped + claim.status.skipped} unchanged or empty captures skipped. Visual explanations appear on your other screen as they finish.</small></div></details>
      {claim.status.failed > 0 && <section className="capture-notice capture-error" aria-label="Processing failures">
        <div className="capture-failures"><p>{claim.status.failed} items need another processing attempt.</p>{claim.status.items.filter(item => item.status === 'failed').map(item => <div key={item.id}><span>{item.kind === 'photo' ? 'Photo' : 'Audio'} · {new Date(item.capturedAt).toLocaleTimeString()}<small>{item.error}</small></span><button className="learning-text-button" disabled={!!retrying} onClick={async () => { setRetrying(item.id); try { await retryCaptureItem(claim.token, item.id); const status = await getCaptureStatus(claim.token); if (mounted.current) setClaim({ ...claim, status }) } catch (error) { if (mounted.current) setError(message(error)) } finally { if (mounted.current) setRetrying('') } }}><RotateCcw size={14}/>{retrying === item.id ? 'Retrying…' : 'Retry'}</button></div>)}</div>
      </section>}
      {claim.status.failed > claim.status.items.filter(item => item.status === 'failed').length && <p className="capture-notice">Earlier items also need another attempt. Use “Retry failed items” on your computer to retry all of them.</p>}
      <details className="capture-settings"><summary>Capture settings & privacy</summary><div className="capture-details-body">
        <div className="capture-switches"><label><input type="checkbox" checked={photo} disabled={active || !capabilities?.photo} onChange={event => setPhoto(event.target.checked)}/> Slide photos</label><label><input type="checkbox" checked={audio} disabled={active || !capabilities?.audio} onChange={event => setAudio(event.target.checked)}/> Lecture audio</label></div>
        <label className="capture-interval">Photo interval <select value={interval} disabled={active || !photo} onChange={event => setIntervalValue(Number(event.target.value))}><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option></select></label>
        <p className="capture-provider">Pause capture to change these settings. Unchanged slides are skipped automatically; “Take photo” always saves a frame.</p>
        <aside className="capture-privacy"><h2>Before you start</h2><p>Photos are read by the server’s configured AI provider. Audio is transcribed by ElevenLabs. Successful raw photos and clips are deleted from the server after their text is saved; failed items stay available for retry. Unsent material stays on this phone until accepted.</p><p>Start only when you have permission to capture this lecture. You can pause at any time, or disconnect this phone from the computer.</p></aside>
      </div></details>
      <section className="capture-controls" aria-label="Capture controls">
        <div className="capture-action-row"><button className="primary-button capture-start" disabled={state === 'stopping' || ended || !storageReady || (!photo && !audio) || !capabilities?.available || queueState.blocked} onClick={() => { if (active) void stop(); else void start() }}>{active ? <><Pause size={22}/>{state === 'stopping' ? 'Saving…' : 'Pause'}</> : <><Play size={22}/>{state === 'paused' ? 'Resume capture' : 'Start capture'}</>}</button>
        {photo && <button className="secondary-button capture-snap" disabled={state !== 'recording' || takingPhoto} onClick={() => { void snap() }}><Camera size={22}/>{takingPhoto ? 'Saving…' : 'Take photo'}</button>}</div>
        <p className="capture-foreground">Keep this page open and your phone unlocked.{wakeActive && ' Screen stays awake.'}</p>
      </section>
    </>}
  </main>
}
