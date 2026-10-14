import type { CaptureKind } from '../../../shared/lecture-capture'

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
    recorder.addEventListener('stop', () => { clearTimeout(timer); resolve({ blob: new Blob(parts, { type: recorder.mimeType || parts[0]?.type || 'audio/mp4' }), capturedAt: new Date(started).toISOString(), durationMs: (stoppedAt || Date.now()) - started, interrupted }) }, { once: true })
    recorder.start()
    timer = setTimeout(stop, durationMs)
  })
  return { done, stop }
}
export interface CapturedMedia { kind: CaptureKind; blob: Blob; capturedAt: string; durationMs?: number }
export interface CaptureEngineOptions {
  video: HTMLVideoElement
  audio: boolean
  photo: boolean
  photoIntervalMs: number
  canCapture: () => boolean
  onMedia: (media: CapturedMedia) => Promise<void>
  onPaused: (message: string) => void
  onSkipped: () => void
}
export class CaptureEngine {
  private options: CaptureEngineOptions
  private stream: MediaStream | null = null
  private generation = 0
  private recording: ReturnType<typeof completeAudioWindow> | null = null
  private audioTask: Promise<void> | null = null
  private photoTask: Promise<void> | null = null
  private photoTimer: ReturnType<typeof setTimeout> | undefined
  private stopping: Promise<void> | null = null
  private previous: Uint8ClampedArray | null = null
  private lastPhotoAt = 0
  private running = false
  constructor(options: CaptureEngineOptions) { this.options = options }
  async start() {
    const generation = ++this.generation
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open the HTTPS pairing link in Safari to allow camera and microphone access.')
    if (this.options.audio && typeof MediaRecorder === 'undefined') throw new Error('Audio recording is unavailable in this browser. Try Safari or turn off audio.')
    const stream = await acquireCaptureStream(() => navigator.mediaDevices.getUserMedia({ video: this.options.photo ? { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } } : false, audio: this.options.audio }), () => generation !== this.generation)
    if (!stream) return false
    this.stream = stream
    for (const track of stream.getTracks()) track.addEventListener('ended', () => this.pause('Camera or microphone disconnected. Tap Start to reconnect.'), { once: true })
    this.running = true
    if (this.options.photo) {
      this.options.video.srcObject = stream
      try { await this.options.video.play() } catch { await this.stop(); throw new Error('The camera preview could not start. Tap Start to try again.') }
    }
    if (!this.running || generation !== this.generation) return false
    if (this.options.audio) this.audioTask = this.audioLoop()
    if (this.options.photo) this.schedulePhoto(0)
    return this.running && generation === this.generation
  }
  private pause(message: string) { if (!this.running) return; this.options.onPaused(message); void this.stop() }
  private async audioLoop() {
    const audio = new MediaStream(this.stream!.getAudioTracks())
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
    while (this.running) {
      if (!this.options.canCapture()) { this.pause('Uploads are catching up. Capture is paused; keep this page open.'); break }
      try {
        this.recording = completeAudioWindow(new MediaRecorder(audio, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined), 20_000)
        const media = await this.recording.done
        this.recording = null
        if (media.blob.size && media.durationMs > 0) await this.options.onMedia({ ...media, kind: 'audio' })
        if (media.interrupted) { this.pause('The microphone recording was interrupted. Its final audio has been queued. Tap Start to reconnect.'); break }
      } catch (error) { this.pause(error instanceof Error ? error.message : 'Audio recording was interrupted.'); break }
    }
  }
  private schedulePhoto(delay: number) {
    if (!this.running) return
    this.photoTimer = setTimeout(() => {
      this.photoTask = this.photo().catch(error => { this.pause(error instanceof Error ? error.message : 'The photo could not be saved.') }).finally(() => { this.photoTask = null; this.schedulePhoto(this.options.photoIntervalMs) })
    }, delay)
  }
  private async photo() {
    if (!this.running) return
    if (!this.options.canCapture()) { this.pause('Uploads are catching up. Capture is paused; keep this page open.'); return }
    const video = this.options.video
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return
    const sample = document.createElement('canvas'); sample.width = 128; sample.height = 96
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })!
    sampleContext.drawImage(video, 0, 0, 128, 96)
    const pixels = sampleContext.getImageData(0, 0, 128, 96).data
    if (!frameChanged(this.previous, pixels, Date.now() - this.lastPhotoAt)) { this.options.onSkipped(); return }
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    const capturedAt = new Date().toISOString()
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode the photo.')), 'image/jpeg', .8))
    await this.options.onMedia({ kind: 'photo', blob, capturedAt })
    this.previous = pixels
    this.lastPhotoAt = Date.now()
  }
  stop(): Promise<void> {
    this.generation++; this.running = false; clearTimeout(this.photoTimer)
    if (this.stopping) return this.stopping
    this.recording?.stop()
    // Stop hardware immediately; the recorder still dispatches its final blobs.
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null
    this.options.video.srcObject = null
    this.stopping = Promise.all([this.audioTask, this.photoTask]).then(() => {}).finally(() => { this.stopping = null })
    return this.stopping
  }
}
