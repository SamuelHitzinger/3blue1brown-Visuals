import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureCapabilities, CaptureClaim } from '../../../shared/lecture-capture'
import { Camera, Check, Pause, Play, RotateCcw, Maximize, Settings } from './Icons'
import CaptureConnect from './CaptureConnect'
import { setupCaptureApp } from './captureApp'
import { fullFrame } from './captureFraming'
import type { CaptureFrame } from './captureFraming'
import { CaptureHTTPError, claimCapture, claimStorageKey, forgetCaptureClaim, getCaptureStatus, getDeviceCaptureCapabilities, prepareCaptureClaim, readCaptureClaim, retryCaptureItem, saveCaptureClaim, uploadCapture } from './captureClient'
import { CaptureQueue, IndexedCaptureStore } from './captureQueue'
import type { QueueSnapshot } from './captureQueue'
import { CaptureEngine, pauseWhenHidden } from './captureEngine'
import type { CaptureZoom } from './captureEngine'
import { captureHealth } from './captureHealth'
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
  const [interval, setIntervalValue] = useState(15)
  const [lastStatusAt, setLastStatusAt] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [skipped, setSkipped] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [wakeActive, setWakeActive] = useState(false)
  const [retrying, setRetrying] = useState('')
  const [zoom, setZoom] = useState<CaptureZoom | null>(null)
  const [zoomValue, setZoomValue] = useState(1)
  const [previewRatio, setPreviewRatio] = useState(4 / 3)
  const [frame, setFrame] = useState<CaptureFrame>(fullFrame)
  const [framed, setFramed] = useState(false)
  const [framing, setFraming] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
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
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const cleanup = setupCaptureApp()
    return () => { cleanup(); clearInterval(clock); mounted.current = false; void engine.current?.stop(); void wake.current?.release().catch(() => {}) }
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
        if (!saved) return
        try { next = { token: saved.token, status: await getCaptureStatus(saved.token, controller.signal) } }
        catch (error) { if (error instanceof CaptureHTTPError && [401, 403, 404, 410].includes(error.status)) forgetCaptureClaim(localStorage, saved.pairingId); throw error }
      }
      if (active) { setClaim(next); setConnecting(false); setLastStatusAt(Date.now()) }
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
      const requestedAt = Date.now()
      try {
        const status = await getCaptureStatus(claim.token, controller.signal)
        if (!active) return
        setClaim(current => current?.status.id === status.id ? { ...current, status } : current)
        setLastStatusAt(requestedAt)
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
      video: video.current, audio, photo, photoIntervalMs: interval * 1000, deviceId: deviceId || undefined,
      canCapture: () => sender.hasCapacity(),
      onPaused: reason => { void stop(reason) },
      onSkipped: () => { if (mounted.current) setSkipped(value => value + 1) },
      onZoomChanged: value => { if (mounted.current && engine.current === capture) { setZoom(value); setZoomValue(value.value) } },
      onFrameChanged: (value, automatic) => { if (mounted.current && engine.current === capture) { setFrame(value); setFramed(automatic) } },
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
      void navigator.mediaDevices.enumerateDevices().then(devices => { if (mounted.current) setCameras(devices.filter(device => device.kind === 'videoinput')) }).catch(() => {})
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
      if (mounted.current) { setState('paused'); setError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Allow camera and microphone access in your browser settings, then tap Start again.' : message(error)) }
    }
  }
  const ended = claim?.status.state === 'revoked' || claim?.status.state === 'expired'
  const active = state === 'recording' || state === 'starting' || state === 'stopping'
  const health = claim && storageReady ? captureHealth(claim.status, queueState.pending, lastStatusAt, now, queueState.lastUploadedAt) : null
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
  const connect = (secret: string) => {
    if (busy.current || (!ended && queueState.pending) || queueState.unsaved) { setError('Pause and let uploads finish before switching lectures.'); return }
    try {
      prepareCaptureClaim(localStorage, secret)
      // An explicitly scanned replacement supersedes an expired URL fragment.
      history.replaceState({}, '', '/capture')
      if (ended && queueState.pending) setNote(`${queueState.pending} unsent items from the ended connection remain stored on this phone. They cannot upload to this new lecture. Keep this browser’s data to retain them.`)
      setError(''); setReload(value => value + 1)
    }
    catch (error) { setError(message(error)) }
  }
  const autoFrame = async () => {
    if (framed) { engine.current?.resetFrame(); setNote('Manual view restored.'); return }
    setFraming(true)
    try {
      const found = await engine.current?.frameBoard()
      if (mounted.current) setNote(found ? 'Board framed. Check the edges; tap Reset frame to undo.' : 'No clear board edges found. Use pinch zoom or move closer.')
    } catch { setNote('Could not frame this view. Use pinch zoom instead.') }
    finally { if (mounted.current) setFraming(false) }
  }
  const pointerEnd = (id: number) => { pointers.current.delete(id); pinch.current = null }
  const clockText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  return <main className="capture-page">
    <header className="capture-heading">
      <div><span className="capture-eyebrow">Aha! Recorder</span><h1>{claim?.status.title ?? 'Lecture recorder'}</h1></div>
      <button className="capture-icon-button" aria-label="Recorder settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><Settings size={22}/></button>
    </header>
    {loading && <p className="capture-notice" role="status">Connecting…</p>}
    {error && <div className="capture-notice capture-error" role="alert">{error}<button className="capture-text-button" onClick={() => { setError(''); if (!claim) setReload(value => value + 1) }}>Dismiss</button></div>}
    {!loading && (!claim || connecting) && <CaptureConnect onConnect={connect} onCancel={claim ? () => setConnecting(false) : undefined}/>}
    {claim && !connecting && <>
      <section className="capture-preview" aria-label="Camera and recording status" style={{ aspectRatio: previewRatio * frame.width / frame.height, width: `min(100%, ${55 * previewRatio * frame.width / frame.height}dvh)` }}
        onPointerDown={event => {
          if (state !== 'recording' || !photo || (event.target as HTMLElement).closest('button')) return
          event.currentTarget.setPointerCapture(event.pointerId)
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointers.current.size === 2) { const [a,b] = [...pointers.current.values()]; pinch.current = { distance: Math.hypot(a.x-b.x,a.y-b.y), zoom: zoomValue } }
        }}
        onPointerMove={event => {
          if (!pointers.current.has(event.pointerId)) return
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pinch.current && pointers.current.size === 2 && pinch.current.distance > 0) {
            const [a,b] = [...pointers.current.values()]
            changeZoom(Math.max(zoom?.min ?? 1, Math.min(zoom?.max ?? 4, pinch.current.zoom * Math.hypot(a.x-b.x,a.y-b.y) / pinch.current.distance)))
          }
        }} onPointerUp={event => pointerEnd(event.pointerId)} onPointerCancel={event => pointerEnd(event.pointerId)} onLostPointerCapture={event => pointerEnd(event.pointerId)}>
        <video ref={video} muted playsInline aria-label="Rear camera preview"
          style={{ width: `${100/frame.width}%`, height: `${100/frame.height}%`, left: `${-100*frame.x/frame.width}%`, top: `${-100*frame.y/frame.height}%` }}
          onLoadedMetadata={event => { const camera=event.currentTarget; if(camera.videoWidth && camera.videoHeight) setPreviewRatio(camera.videoWidth/camera.videoHeight) }}
          onResize={event => { const camera=event.currentTarget; if(camera.videoWidth && camera.videoHeight) setPreviewRatio(camera.videoWidth/camera.videoHeight) }}
          className={!photo || state !== 'recording' ? 'capture-preview-inactive' : ''}/>
        {state !== 'recording' && <div className="capture-preview-placeholder"><Camera size={42}/><p>{state === 'starting' ? 'Opening camera…' : state === 'stopping' ? 'Saving…' : ended ? 'Connect a new lecture' : 'Ready to record'}</p></div>}
        {state === 'recording' && !photo && <div className="capture-preview-placeholder"><span className="capture-mic-glyph">◉</span><p>Audio only</p></div>}
        <div className={`capture-live-status ${state === 'recording' ? 'is-recording' : ''}`} role="status"><span/>{state === 'recording' ? clockText : state === 'ready' ? 'Ready' : state === 'paused' ? 'Paused' : 'Please wait'}</div>
        {photo && state === 'recording' && <button className="capture-frame-button" disabled={framing} onClick={() => { void autoFrame() }}><Maximize size={16}/>{framing ? 'Finding…' : framed ? 'Reset frame' : 'Frame board'}</button>}
      </section>
      {photo && <section className="capture-zoom" aria-label="Camera zoom">
        <div className="capture-zoom-presets">{[1,2,3].filter(value => value >= (zoom?.min ?? 1) && value <= (zoom?.max ?? 4)).map(value => <button key={value} aria-label={`Zoom ${value}×`} aria-pressed={!framed && Math.abs(zoomValue-value)<.05} disabled={state !== 'recording'} onClick={() => changeZoom(value)}>{value}×</button>)}<span>{framed ? 'Framed' : `${zoomValue.toFixed(1)}×`}</span></div>
        <input aria-label="Zoom" type="range" min={zoom?.min ?? 1} max={zoom?.max ?? 4} step={zoom?.step ?? .1} value={zoomValue} disabled={state !== 'recording'} onChange={event => changeZoom(Number(event.target.value))}/>
      </section>}
      <section className="capture-controls" aria-label="Capture controls">
        <button className="capture-icon-button" disabled={state !== 'recording' || !photo || takingPhoto} aria-label="Take photo" onClick={() => { void snap() }}><Camera size={25}/></button>
        <button className={`capture-record-button ${active ? 'is-recording' : ''}`} aria-label={active ? 'Pause recording' : state === 'paused' ? 'Resume recording' : 'Start recording'} disabled={state === 'starting' || state === 'stopping' || ended || !storageReady || (!photo && !audio) || !capabilities?.available || queueState.blocked} onClick={() => { if (active) void stop('Recording paused.'); else void start() }}>{active ? <Pause size={28}/> : <Play size={28}/>}</button>
        <span className="capture-control-label">{state === 'recording' ? 'Recording' : state === 'paused' ? 'Resume' : 'Record'}</span>
      </section>
      <p className={`capture-status-line capture-status-${health?.tone ?? 'waiting'}`} role="status">{health?.title ?? 'Getting ready…'}{queueState.pending > 0 ? ` · ${queueState.pending} uploading` : ''}</p>
      {health?.tone === 'error' && <p className="capture-notice capture-error">{health.detail}</p>}
      {note && <p className="capture-note" role="status">{note}</p>}
      <p className="capture-foreground">Keep app open and phone unlocked.{wakeActive ? ' Screen stays awake.' : ''}</p>
      {capabilities && !capabilities.audio && <p className="capture-notice capture-error">{capabilities.detail || 'Audio transcription unavailable. Photos can still be captured.'}</p>}
      {queueState.message && <div className="capture-notice capture-error" role="alert">{queueState.message}{!ended && <button className="capture-text-button" onClick={() => { void queue.current?.retry() }}>Retry uploads</button>}</div>}
      {queueState.unsaved > 0 && <p className="capture-notice capture-error" role="alert">Keep app open: {queueState.unsaved} items need space to save.</p>}
      {claim.status.failed > 0 && <details className="capture-details capture-failures"><summary>{claim.status.failed} recordings need attention</summary>
        {claim.status.items.filter(item => item.status === 'failed').map(item => <div key={item.id}><p>{item.kind === 'audio' ? 'Audio' : 'Photo'} · {new Date(item.capturedAt).toLocaleTimeString()}<small>{item.error}</small></p><button className="capture-text-button" disabled={!!retrying} onClick={async () => {
          setRetrying(item.id)
          try { await retryCaptureItem(claim.token,item.id); const status=await getCaptureStatus(claim.token); if(mounted.current) setClaim({...claim,status}) }
          catch(error) { if(mounted.current) setError(message(error)) }
          finally { if(mounted.current) setRetrying('') }
        }}><RotateCcw size={14}/>{retrying === item.id ? 'Retrying…' : 'Retry'}</button></div>)}
        {claim.status.failed > claim.status.items.filter(item=>item.status==='failed').length && <p>Retry earlier recordings from lecture page on your computer.</p>}
      </details>}
      {ended && <button className="capture-button" disabled={active || !!queueState.unsaved} onClick={() => setConnecting(true)}>Connect another lecture</button>}
    </>}
    {settingsOpen && <section className="capture-settings" aria-label="Recorder settings">
      <div className="capture-settings-heading"><h2>Settings</h2><button className="capture-text-button" onClick={() => setSettingsOpen(false)}>Done</button></div>
      {claim && <>
        <div className="capture-switches"><label><input type="checkbox" checked={photo} disabled={active || !capabilities?.photo} onChange={event=>setPhoto(event.target.checked)}/> Camera</label><label><input type="checkbox" checked={audio} disabled={active || !capabilities?.audio} onChange={event=>setAudio(event.target.checked)}/> Microphone</label></div>
        <label className="capture-setting">Photo interval<select value={interval} disabled={active || !photo} onChange={event=>setIntervalValue(Number(event.target.value))}>{[10,15,30,60].map(value=><option key={value} value={value}>{value} seconds</option>)}</select></label>
        {cameras.length > 1 && <label className="capture-setting">Camera<select value={deviceId} disabled={active} onChange={event=>{setDeviceId(event.target.value);setZoomValue(1)}}><option value="">Automatic rear camera</option>{cameras.map((camera,index)=><option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index+1}`}</option>)}</select></label>}
        <p>Pause to change camera or microphone. Pinch preview to zoom. {zoom?.mode === 'camera' ? 'Camera zoom available.' : 'Digital zoom crops the image; it cannot restore missing detail.'}</p>
        <button className="capture-button" disabled={active || (!ended && !!queueState.pending) || !!queueState.unsaved || loading} onClick={()=>{setConnecting(true);setSettingsOpen(false)}}>Connect another lecture</button>
        {(queueState.pending > 0 || queueState.unsaved > 0) && <p>{ended && !queueState.unsaved ? 'Unsent items stay on this phone when you connect another lecture; an ended connection cannot upload them.' : 'Finish uploads before switching lectures.'}</p>}
        <details className="capture-details"><summary><Check size={14}/> Upload details</summary><p>{queueState.pending} on phone · {claim.status.pending} processing · {claim.status.processed} saved · {skipped+claim.status.skipped} unchanged or empty</p><p>{health?.detail}</p></details>
      </>}
      <div className="capture-install"><h3>Add to Home Screen</h3><p>In Safari: Share → Add to Home Screen → Open as Web App. Open Recorder from its icon, then scan a lecture QR inside the app.</p><p>Same address every time: <a href="/capture">{location.origin}/capture</a>. Keep Tailscale connected.</p></div>
      <details className="capture-details"><summary>Framing & privacy</summary><p>Frame board is experimental. It looks for a clear rectangle on this phone and crops captured photos to that area. It can mistake other rectangles for a board. Check the result; angled, obscured, or low-contrast boards may need manual zoom. It does not track a moving camera. No extra AI request is used for framing.</p><p>Audio and photos go to this lecture’s configured providers. Successful raw captures are deleted after text is saved; failures remain for retry. Unsent media stays on this device. Start only with permission to record.</p></details>
    </section>}
    {!claim && !settingsOpen && <p className="capture-install-hint">Save this page to your Home Screen for next time.</p>}
  </main>
}
