import type { CaptureKind } from '../../../shared/lecture-capture'
import { detectBoard, zoomFrame } from './captureFraming.ts'
import type { CaptureFrame } from './captureFraming.ts'

export async function acquireCaptureStream(acquire: () => Promise<MediaStream>, cancelled: () => boolean) {
  const stream = await acquire()
  if (cancelled()) { stream.getTracks().forEach(track => track.stop()); return null }
  return stream
}
export function pauseWhenHidden(document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>, stop: () => void) {
  const visible = () => { if (document.visibilityState !== 'visible') stop() }
  document.addEventListener('visibilitychange', visible)
  return () => document.removeEventListener('visibilitychange', visible)
}
export function frameChanged(previous: Uint8ClampedArray | null, next: Uint8ClampedArray, elapsedMs = 0) {
  if (!previous || previous.length !== next.length || elapsedMs >= 60_000) return true
  let difference = 0, count = 0
  for (let i = 0; i < next.length; i++) if (i % 4 !== 3) { difference += Math.abs(previous[i] - next[i]); count++ }
  return difference / Math.max(1, count) > 9
}
export function completeAudioWindow(recorder: MediaRecorder, durationMs: number) {
  const parts: Blob[] = [], started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined, stopRequested = false, stoppedAt = 0, interrupted = false
  const stop = () => { if (stopRequested) return; stopRequested = true; stoppedAt = Date.now(); clearTimeout(timer); if (recorder.state !== 'inactive') recorder.stop() }
  const done = new Promise<{ blob: Blob; capturedAt: string; durationMs: number; interrupted: boolean }>(resolve => {
    recorder.addEventListener('dataavailable', event => { if (event.data.size) parts.push(event.data) })
    // Recording errors are followed by dataavailable and stop; keep that final data.
    recorder.addEventListener('error', () => { interrupted = true; clearTimeout(timer) }, { once: true })
    recorder.addEventListener('stop', () => { clearTimeout(timer); resolve({ blob: new Blob(parts, { type: parts[0]?.type || recorder.mimeType || 'audio/mp4' }), capturedAt: new Date(started).toISOString(), durationMs: (stoppedAt || Date.now()) - started, interrupted }) }, { once: true })
  })
  // Initialization errors must be synchronous so a prestarted window cannot
  // leave an unobserved rejected promise while the previous clip is saving.
  recorder.start()
  timer = setTimeout(stop, durationMs)
  return { done, stop }
}
export interface CapturedMedia { kind: CaptureKind; blob: Blob; capturedAt: string; durationMs?: number }
export interface CaptureZoom { value: number; min: number; max: number; step: number; mode: 'camera' | 'digital'; digitalScale: number }
type ZoomTrack = Omit<MediaStreamTrack, 'getCapabilities' | 'getSettings'> & { getCapabilities(): MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } }; getSettings(): MediaTrackSettings & { zoom?: number } }
export interface CaptureEngineOptions {
  video: HTMLVideoElement
  audio: boolean
  photo: boolean
  photoIntervalMs: number
  canCapture: () => boolean
  onMedia: (media: CapturedMedia) => Promise<void>
  onPaused: (message: string) => void
  onSkipped: () => void
  onZoomChanged?: (zoom: CaptureZoom) => void
  onFrameChanged?: (frame: CaptureFrame, automatic: boolean) => void
  deviceId?: string
}
export class CaptureEngine {
  private options: CaptureEngineOptions
  private stream: MediaStream | null = null
  private generation = 0
  private recording: ReturnType<typeof completeAudioWindow> | null = null
  private audioTask: Promise<void> | null = null
  private photoTask: Promise<void> | null = null
  private pendingManual = false
  private zoom: CaptureZoom = { value: 1, min: 1, max: 4, step: .1, mode: 'digital', digitalScale: 1 }
  private zoomTask: Promise<void> = Promise.resolve()
  private boardFrame: CaptureFrame | null = null
  private photoTimer: ReturnType<typeof setTimeout> | undefined
  private stopping: Promise<void> | null = null
  private previous: Uint8ClampedArray | null = null
  private lastPhotoAt = 0
  private running = false
  constructor(options: CaptureEngineOptions) { this.options = options }
  async start() {
    const generation = ++this.generation
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open the HTTPS pairing link in your browser to allow camera and microphone access.')
    if (this.options.audio && typeof MediaRecorder === 'undefined') throw new Error('Audio recording is unavailable in this browser. Try a current Safari or Chrome browser, or turn off audio.')
    const stream = await acquireCaptureStream(() => navigator.mediaDevices.getUserMedia({ video: this.options.photo ? { ...(this.options.deviceId ? { deviceId: { exact: this.options.deviceId } } : { facingMode: { ideal: 'environment' } }), width: { ideal: 1920 }, height: { ideal: 1440 } } : false, audio: this.options.audio }), () => generation !== this.generation)
    if (!stream) return false
    this.stream = stream
    for (const track of stream.getTracks()) track.addEventListener('ended', () => this.pause('Camera or microphone disconnected. Tap Start to reconnect.'), { once: true })
    this.running = true
    if (this.options.photo) {
      this.options.video.srcObject = stream
      try { await this.options.video.play() } catch { await this.stop(); throw new Error('The camera preview could not start. Tap Start to try again.') }
      if (!this.running || generation !== this.generation) return false
      const track = stream.getVideoTracks()[0] as ZoomTrack
      const range = track?.getCapabilities?.().zoom
      if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min > 0 && range.max > range.min) {
        const value = Math.max(range.min, Math.min(range.max, track.getSettings?.().zoom ?? 1))
        this.zoom = { value, min: range.min, max: range.max, step: range.step || .1, mode: 'camera', digitalScale: 1 }
      }
      this.options.onZoomChanged?.({ ...this.zoom })
      this.notifyFrame()
    }
    if (!this.running || generation !== this.generation) return false
    if (this.options.audio) this.audioTask = this.audioLoop()
    if (this.options.photo) this.schedulePhoto(0)
    return this.running && generation === this.generation
  }
  private pause(message: string) { if (!this.running) return; this.options.onPaused(message); void this.stop() }
  setZoom(value: number): Promise<void> {
    const generation = this.generation
    const task = this.zoomTask.then(async () => {
      if (!this.running || !this.options.photo || generation !== this.generation || !Number.isFinite(value)) return
      const { min, max, step } = this.zoom
      const next = Math.max(min, Math.min(max, Math.round((value - min) / step) * step + min))
      if (this.zoom.mode === 'camera') {
        const track = this.stream!.getVideoTracks()[0] as ZoomTrack
        await track.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] })
        if (!this.running || generation !== this.generation) return
        this.zoom = { ...this.zoom, value: track.getSettings?.().zoom ?? next }
      } else this.zoom = { ...this.zoom, value: next, digitalScale: next }
      this.boardFrame = null
      this.previous = null
      this.options.onZoomChanged?.({ ...this.zoom })
      this.notifyFrame()
    })
    // A rejected device constraint must not poison subsequent requests or photos.
    this.zoomTask = task.catch(() => {})
    return task
  }
  private currentFrame() { return this.boardFrame ?? zoomFrame(this.zoom.digitalScale) }
  private notifyFrame() { this.options.onFrameChanged?.(this.currentFrame(), !!this.boardFrame) }
  resetFrame() { this.boardFrame = null; this.previous = null; this.notifyFrame() }
  async frameBoard(): Promise<boolean> {
    const generation = this.generation
    await this.zoomTask
    const video = this.options.video
    if (!this.running || generation !== this.generation || !this.options.photo || !video.videoWidth || video.readyState < 2) return false
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = detectBoard(context.getImageData(0, 0, canvas.width, canvas.height))
    if (!frame) return false
    this.boardFrame = frame; this.previous = null; this.notifyFrame()
    return true
  }
  takePhoto(): Promise<void> { return this.requestPhoto(true) }
  private async audioLoop() {
    const audio = new MediaStream(this.stream!.getAudioTracks())
    // Prefer native MP4 recording on iPhone; retain WebM/Ogg fallbacks.
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
    const begin = () => completeAudioWindow(new MediaRecorder(audio, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined), 15_000)
    while (this.running || this.recording) {
      try {
        if (!this.recording) {
          if (!this.options.canCapture()) { this.pause('Uploads are catching up. Capture is paused; keep this page open.'); break }
          this.recording = begin()
        }
        const media = await this.recording.done
        this.recording = null
        // Start the next complete file before waiting for IndexedDB. Only one
        // recorder and one pending save may be in flight, including during stop.
        let nextError: unknown
        if (this.running && !media.interrupted && this.options.canCapture()) {
          try { this.recording = begin() } catch (error) { nextError = error }
        }
        if (media.blob.size && media.durationMs > 0) {
          const watchdog = setTimeout(() => this.pause('Saving audio is taking too long. Capture paused to preserve the final clips. Keep this page open.'), 10_000)
          try { await this.options.onMedia({ ...media, kind: 'audio' }) } finally { clearTimeout(watchdog) }
        }
        if (nextError) throw nextError
        if (media.interrupted) { this.pause('The microphone recording was interrupted. Its final audio has been queued. Tap Start to reconnect.'); break }
      } catch (error) {
        this.pause(error instanceof Error ? error.message : 'Audio recording was interrupted.')
        // A failed save can pause a newer recorder. Preserve its final output too.
        if (this.recording) {
          const final = this.recording; this.recording = null; final.stop()
          const media = await final.done
          if (media.blob.size && media.durationMs > 0) await this.options.onMedia({ ...media, kind: 'audio' }).catch(() => {})
        }
        break
      }
    }
  }
  private schedulePhoto(delay: number) {
    if (!this.running) return
    this.photoTimer = setTimeout(() => { void this.requestPhoto(false) }, delay)
  }
  private requestPhoto(manual: boolean): Promise<void> {
    if (!this.running || !this.options.photo) return Promise.resolve()
    clearTimeout(this.photoTimer)
    if (manual) this.pendingManual = true
    if (this.photoTask) return this.photoTask
    this.photoTask = (async () => {
      do {
        const force = this.pendingManual
        this.pendingManual = false
        await this.photo(force)
      } while (this.running && this.pendingManual)
    })().catch(error => { this.pause(error instanceof Error ? error.message : 'The photo could not be saved.') }).finally(() => {
      this.photoTask = null
      this.schedulePhoto(this.options.photoIntervalMs)
    })
    return this.photoTask
  }
  private async photo(force: boolean) {
    const generation = this.generation
    // Wait for all slider requests, including requests added while one settles.
    let zoomTask: Promise<void>
    do { zoomTask = this.zoomTask; await zoomTask } while (zoomTask !== this.zoomTask)
    if (!this.running || generation !== this.generation) return
    if (!this.options.canCapture()) { this.pause('Uploads are catching up. Capture is paused; keep this page open.'); return }
    const video = this.options.video
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return
    const sample = document.createElement('canvas'); sample.width = 128; sample.height = 96
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })!
    const frame = this.currentFrame()
    const width = video.videoWidth * frame.width, height = video.videoHeight * frame.height
    const x = video.videoWidth * frame.x, y = video.videoHeight * frame.y
    sampleContext.drawImage(video, x, y, width, height, 0, 0, 128, 96)
    const pixels = sampleContext.getImageData(0, 0, 128, 96).data
    if (!force && !frameChanged(this.previous, pixels, Date.now() - this.lastPhotoAt)) { this.options.onSkipped(); return }
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(width, height))
    canvas.width = Math.max(1, Math.floor(width * ratio)); canvas.height = Math.max(1, Math.floor(height * ratio))
    canvas.getContext('2d')!.drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height)
    const capturedAt = new Date().toISOString()
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode the photo.')), 'image/jpeg', .8))
    await this.options.onMedia({ kind: 'photo', blob, capturedAt })
    this.previous = pixels
    this.lastPhotoAt = Date.now()
  }
  stop(): Promise<void> {
    this.generation++; this.running = false; this.pendingManual = false; clearTimeout(this.photoTimer)
    if (this.stopping) return this.stopping
    this.recording?.stop()
    // Stop hardware immediately; the recorder still dispatches its final blobs.
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null
    this.options.video.srcObject = null
    this.stopping = Promise.all([this.audioTask, this.photoTask, this.zoomTask]).then(() => {}).finally(() => { this.stopping = null })
    return this.stopping
  }
}
