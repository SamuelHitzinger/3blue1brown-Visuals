import type { CaptureKind } from '../../../shared/lecture-capture'
import { boardZoom, detectBoard, fullFrame, zoomFrame } from './captureFraming.ts'
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
  return { done, stop, startedAt: started }
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
  canCapturePhoto?: () => boolean
  onMedia: (media: CapturedMedia) => Promise<void>
  onPaused: (message: string) => void
  onSkipped: () => void
  onZoomChanged?: (zoom: CaptureZoom) => void
  onFrameChanged?: (frame: CaptureFrame, automatic: boolean) => void
  autoFrame?: boolean
  onAutoFrameChanged?: (enabled: boolean) => void
  deviceId?: string
}
export class CaptureEngine {
  private options: CaptureEngineOptions
  private stream: MediaStream | null = null
  private generation = 0
  private recording: ReturnType<typeof completeAudioWindow> | null = null
  private overlapRecording: ReturnType<typeof completeAudioWindow> | null = null
  private overlapTimer: ReturnType<typeof setTimeout> | undefined
  private audioTask: Promise<void> | null = null
  private photoTask: Promise<void> | null = null
  private pendingManual = false
  private zoom: CaptureZoom = { value: 1, min: 1, max: 4, step: .1, mode: 'digital', digitalScale: 1 }
  private zoomTask: Promise<void> = Promise.resolve()
  private boardFrame: CaptureFrame | null = null
  private autoFraming: boolean
  private framingRevision = 0
  private autoZoomFailed = false
  private framingStarted = false
  private cameraReadyAt = 0
  private cameraFrameTime = 0
  private cancelCameraWait: (() => void) | null = null
  private photoTimer: ReturnType<typeof setTimeout> | undefined
  private stopping: Promise<void> | null = null
  private previous: Uint8ClampedArray | null = null
  private lastPhotoAt = 0
  private running = false
  constructor(options: CaptureEngineOptions) { this.options = options; this.autoFraming = options.autoFrame !== false }
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
        this.zoom = { value, min: range.min, max: range.max, step: range.step && Number.isFinite(range.step) && range.step > 0 ? range.step : .1, mode: 'camera', digitalScale: 1 }
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
    if (!Number.isFinite(value)) return Promise.resolve()
    this.setAutoFraming(false)
    const generation = this.generation
    const task = this.zoomTask.then(async () => {
      if (!this.running || !this.options.photo || generation !== this.generation || this.autoFraming) return
      const { min, max, step } = this.zoom
      const next = Math.max(min, Math.min(max, Math.round((value - min) / step) * step + min))
      await this.applyZoom(next, generation)
    })
    // A rejected device constraint must not poison subsequent requests or photos.
    this.zoomTask = task.catch(() => {})
    return task
  }
  private async applyZoom(next: number, generation: number) {
    if (this.zoom.mode === 'camera') {
      const track = this.stream!.getVideoTracks()[0] as ZoomTrack
      await track.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] })
      if (!this.running || generation !== this.generation) return
      const actual = track.getSettings?.().zoom
      this.zoom = { ...this.zoom, value: actual && Number.isFinite(actual) ? actual : next }
      this.cameraReadyAt = Date.now() + 250
      this.cameraFrameTime = this.options.video.currentTime
    } else this.zoom = { ...this.zoom, value: next, digitalScale: next }
    this.boardFrame = null
    this.previous = null
    this.options.onZoomChanged?.({ ...this.zoom })
    this.notifyFrame()
  }
  private async waitForCamera(generation: number): Promise<boolean> {
    if (!this.cameraReadyAt) return true
    const readyAt = this.cameraReadyAt
    await new Promise(resolve => setTimeout(resolve, Math.max(0, readyAt - Date.now())))
    if (!this.running || generation !== this.generation) return false
    const video = this.options.video
    // A settling delay alone can still leave a stale, clipped frame after zoom
    // out. Require a newly delivered frame; skip this photo if the feed stalls.
    const fresh = await new Promise<boolean>(resolve => {
      let frameId: number | undefined, poll: ReturnType<typeof setTimeout> | undefined
      const finish = (success: boolean) => {
        clearTimeout(timeout); clearTimeout(poll)
        if (frameId !== undefined) video.cancelVideoFrameCallback(frameId)
        this.cancelCameraWait = null
        resolve(success)
      }
      const timeout = setTimeout(() => finish(false), 750)
      this.cancelCameraWait = () => finish(false)
      if (typeof video.requestVideoFrameCallback === 'function') frameId = video.requestVideoFrameCallback(() => finish(true))
      else {
        const check = () => {
          if (!Number.isFinite(this.cameraFrameTime) || video.currentTime > this.cameraFrameTime) finish(true)
          else poll = setTimeout(check, 25)
        }
        check()
      }
    })
    if (fresh && this.cameraReadyAt === readyAt) this.cameraReadyAt = 0
    return fresh && this.running && generation === this.generation
  }
  private currentFrame() { return this.boardFrame ?? (this.autoFraming ? fullFrame : zoomFrame(this.zoom.digitalScale)) }
  private notifyFrame() { this.options.onFrameChanged?.(this.currentFrame(), !!this.boardFrame) }
  setAutoFraming(enabled: boolean) {
    this.autoFraming = enabled; this.framingRevision++
    this.boardFrame = null; this.previous = null; this.framingStarted = false
    if (enabled) this.autoZoomFailed = false
    if (enabled && this.zoom.mode === 'digital') {
      this.zoom = { ...this.zoom, value: 1, digitalScale: 1 }
      this.options.onZoomChanged?.({ ...this.zoom })
    }
    this.options.onAutoFrameChanged?.(enabled)
    this.notifyFrame()
  }
  resetFrame() { this.setAutoFraming(false) }
  async frameBoard(): Promise<boolean> {
    this.setAutoFraming(true)
    const prepared = await this.preparePhoto()
    return !!prepared && !!this.boardFrame
  }
  private snapshot() {
    const video = this.options.video
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return canvas
  }
  private detectFrame(source: HTMLCanvasElement) {
    try {
      const sample = document.createElement('canvas')
      const scale = Math.min(1, 320 / Math.max(source.width, source.height))
      sample.width = Math.round(source.width * scale); sample.height = Math.round(source.height * scale)
      const context = sample.getContext('2d', { willReadFrequently: true })
      if (!context) return null
      context.drawImage(source, 0, 0, sample.width, sample.height)
      return detectBoard(context.getImageData(0, 0, sample.width, sample.height))
    } catch {
      // Framing is optional. Keep the complete photo when analysis is unavailable.
      return null
    }
  }
  private preparePhoto() {
    const generation = this.generation
    const revision = this.framingRevision
    const valid = () => this.running && generation === this.generation && revision === this.framingRevision
    // Share one queue with manual zoom so no photo uses coordinates from a
    // different camera field of view. A manual override invalidates this work.
    const task = this.zoomTask.then(async () => {
      if (!valid() || !this.options.photo) return null
      if (!await this.waitForCamera(generation) || !valid()) return null
      const adjust = async (value: number) => {
        if (this.autoZoomFailed || this.zoom.mode !== 'camera' || Math.abs(value - this.zoom.value) < .001) return true
        try { await this.applyZoom(value, generation); return await this.waitForCamera(generation) }
        catch { this.autoZoomFailed = true } // Cropping still works without camera controls.
        return true
      }
      if (this.autoFraming && !this.framingStarted) {
        if (!await adjust(this.zoom.min) || !valid()) return null
        this.framingStarted = true
      }
      let source = this.snapshot()
      if (!source) return null
      if (this.autoFraming) {
        let frame = this.detectFrame(source)
        if (!frame && this.zoom.mode === 'camera' && this.zoom.value > this.zoom.min && !this.autoZoomFailed) {
          if (!await adjust(this.zoom.min) || !valid()) return null
          source = this.snapshot()
          if (!source) return null
          frame = this.detectFrame(source)
        }
        if (frame && this.zoom.mode === 'camera' && !this.autoZoomFailed) {
          const target = boardZoom(frame, this.zoom.value, this.zoom.min, this.zoom.max, this.zoom.step)
          // Avoid hunting between adjacent steps due to edge-detection noise.
          if (Math.abs(target - this.zoom.value) >= Math.max(this.zoom.step * .75, this.zoom.value * .08)) {
            if (!await adjust(target) || !valid()) return null
            source = this.snapshot()
            if (!source) return null
            frame = this.detectFrame(source)
            if (!frame) {
              if (!await adjust(this.zoom.min) || !valid()) return null
              source = this.snapshot()
              if (!source) return null
              frame = this.detectFrame(source)
            }
          }
        }
        this.boardFrame = frame // Never retain a crop when detection is lost.
        this.notifyFrame()
      }
      return { source, frame: this.currentFrame(), revision }
    })
    this.zoomTask = task.then(() => {}, () => {})
    return task
  }
  takePhoto(): Promise<void> { return this.requestPhoto(true) }
  private async audioLoop() {
    const audio = new MediaStream(this.stream!.getAudioTracks())
    // Prefer native MP4 recording on iPhone; retain WebM/Ogg fallbacks.
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
    const begin = () => completeAudioWindow(new MediaRecorder(audio, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined), 2_000)
    let saving = false, overlapSupported = true
    let failedOverlap: ReturnType<typeof completeAudioWindow> | null = null
    const failedOverlaps = new WeakSet<ReturnType<typeof completeAudioWindow>>()
    const scheduleOverlap = () => {
      clearTimeout(this.overlapTimer)
      const current = this.recording
      if (!current || !this.running || !overlapSupported || this.overlapRecording || Date.now() >= current.startedAt + 2_000) return
      this.overlapTimer = setTimeout(() => {
        if (!this.running || saving || this.recording !== current || !this.options.canCapture()) return
        try {
          const overlap = this.overlapRecording = begin()
          void overlap.done.then(media => {
            // Some encoders reject concurrency asynchronously. The original
            // recorder still covers this interval; drain the failed clip and
            // continue with single-encoder windows instead of pausing capture.
            if (media.interrupted && this.recording === current) { overlapSupported = false; failedOverlaps.add(overlap) }
          })
        }
        catch { overlapSupported = false } // Some devices permit only one encoder; retain complete files there.
      }, Math.max(0, current.startedAt + 1_000 - Date.now()))
    }
    while (this.running || this.recording) {
      try {
        if (!this.recording) {
          if (!this.options.canCapture()) { this.pause('Uploads are catching up. Capture is paused; keep this page open.'); break }
          this.recording = begin()
          scheduleOverlap()
        }
        const completed = this.recording
        const media = await completed.done
        const interrupted = media.interrupted && !failedOverlaps.has(completed)
        clearTimeout(this.overlapTimer)
        this.recording = this.overlapRecording
        this.overlapRecording = null
        if (this.recording && failedOverlaps.has(this.recording)) { failedOverlap = this.recording; this.recording = null }
        // Complete files overlap by one second, protecting words at clip
        // boundaries. At most two encoders; no extra overlap while storage stalls.
        let nextError: unknown
        if (!this.recording && this.running && !interrupted && this.options.canCapture()) {
          try { this.recording = begin() } catch (error) { nextError = error }
        }
        scheduleOverlap()
        for (const clip of [media, ...(failedOverlap ? [await failedOverlap.done] : [])]) {
          if (clip !== media) failedOverlap = null
          if (!clip.blob.size || clip.durationMs <= 0) continue
          saving = true
          const watchdog = setTimeout(() => this.pause('Saving audio is taking too long. Capture paused to preserve the final clips. Keep this page open.'), 10_000)
          try { await this.options.onMedia({ ...clip, kind: 'audio' }) } finally { clearTimeout(watchdog); saving = false; scheduleOverlap() }
        }
        if (nextError) throw nextError
        if (interrupted) throw new Error('The microphone recording was interrupted. Its final audio has been queued. Tap Start to reconnect.')
      } catch (error) {
        this.pause(error instanceof Error ? error.message : 'Audio recording was interrupted.')
        // A failed save can pause a newer recorder. Preserve its final output too.
        const remaining = [failedOverlap, this.recording, this.overlapRecording].filter(recording => recording !== null)
        failedOverlap = null; this.recording = null; this.overlapRecording = null
        for (const final of remaining) {
          final.stop()
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
    if (this.options.canCapturePhoto?.() === false) { this.options.onSkipped(); return }
    const prepared = await this.preparePhoto()
    if (!prepared || !this.running || generation !== this.generation || prepared.revision !== this.framingRevision) return
    const { source, frame } = prepared
    const sample = document.createElement('canvas'); sample.width = 128; sample.height = 96
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })!
    const width = source.width * frame.width, height = source.height * frame.height
    const x = source.width * frame.x, y = source.height * frame.y
    sampleContext.drawImage(source, x, y, width, height, 0, 0, 128, 96)
    const pixels = sampleContext.getImageData(0, 0, 128, 96).data
    if (!force && !frameChanged(this.previous, pixels, Date.now() - this.lastPhotoAt)) { this.options.onSkipped(); return }
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(width, height))
    canvas.width = Math.max(1, Math.floor(width * ratio)); canvas.height = Math.max(1, Math.floor(height * ratio))
    canvas.getContext('2d')!.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height)
    const capturedAt = new Date().toISOString()
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode the photo.')), 'image/jpeg', .8))
    await this.options.onMedia({ kind: 'photo', blob, capturedAt })
    this.previous = pixels
    this.lastPhotoAt = Date.now()
  }
  stop(): Promise<void> {
    this.generation++; this.running = false; this.pendingManual = false; clearTimeout(this.photoTimer); clearTimeout(this.overlapTimer)
    this.cancelCameraWait?.()
    if (this.stopping) return this.stopping
    this.recording?.stop()
    this.overlapRecording?.stop()
    // Stop hardware immediately; the recorder still dispatches its final blobs.
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null
    this.options.video.srcObject = null
    this.stopping = Promise.all([this.audioTask, this.photoTask, this.zoomTask]).then(() => {}).finally(() => { this.stopping = null })
    return this.stopping
  }
}
