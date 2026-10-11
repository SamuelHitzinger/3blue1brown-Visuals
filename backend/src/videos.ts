import { emptyTokenUsage, TokenUsageTracker, withTokenUsage } from './token-usage.js'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SceneSequence } from 'animlib/core'
import type { Frame } from 'animlib/core'
import type { VideoManifest, VideoRequest, VideoScene } from '../../shared/video/contract'
import { AgentError } from './agents/config.js'
import { contextualVideoRequest, validateSceneRequest } from './scene-requests.js'
import { insertedSceneId } from '../../shared/video/scene-requests'
import type { SceneRequest, SceneRequestInput } from '../../shared/video/scene-requests'
import { videoFailureMessage } from './video-errors.js'
import type { ImageContent } from '@earendil-works/pi-ai'
import { extractUpload, uploadMetadata, uploadType } from './uploads.js'
import type { Upload } from './uploads.js'

import { SHARED_OWNER } from './identity.js'
import { logEvent, logStage } from './logging.js'
import type { ThumbnailArtwork } from '../../shared/video/thumbnail.js'
export { SHARED_OWNER } from './identity.js'

type Row = { id: string; owner: string; request: string; manifest: string }
// Apply the same policy to stored failures from older releases and live events.
function publicManifest(manifest: VideoManifest): VideoManifest {
  return manifest.status === 'failed' ? { ...manifest, error: videoFailureMessage(manifest.errorCode, manifest.scenes.length > 0) } : manifest
}
export interface GenerationContext { videoId: string; owner: string; previousFrame?: Frame; signal: AbortSignal; images?: ImageContent[] }
export type Generator = (request: VideoRequest, index: number, context?: GenerationContext) => Promise<{ scene: Omit<VideoScene, 'audio'> & { audio?: { id: string } }; audio: Uint8Array } | null>
export type ThumbnailGenerator = (request: VideoRequest, context: { signal: AbortSignal; images?: ImageContent[] }) => Promise<ThumbnailArtwork>

// A deterministic fixture exercises audio delivery without claiming to generate narration.
export const simulatedGenerator: Generator = async (_request, index) => {
  if (index >= 3) return null
  await new Promise(resolve => setTimeout(resolve, index === 0 ? 300 : 2500))
  const duration = 6, rate = 8000, samples = duration * rate
  const audio = new Uint8Array(44 + samples * 2), view = new DataView(audio.buffer)
  const write = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, audio.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const envelope = Math.max(0, 1 - i / (rate * 0.3))
    view.setInt16(44 + i * 2, Math.round(Math.sin(i / rate * Math.PI * 2 * (330 + index * 110)) * 2500 * envelope), true)
  }
  return { audio, scene: {
    id: `scene-${index}`, index, duration,
    captions: [{ start: 0, end: duration, text: 'Sample animation: move the slider to explore. Narration is not connected yet.' }],
    source: `export default scene({ end: 'advance', audio: 'audio-${index}' }, s => {
      const distance = s.slider('distance', { label: 'Distance', min: 0.5, max: 3, default: 1.5, step: 0.1 });
      const dot = s.circle('dot-${index}', { radius: 0.3, fill: 'BLUE', position: [-distance, 0] });
      s.play(dot.moveTo([distance, 0]), { duration: 3 });
      s.play(dot.moveTo([-distance, 0]), { duration: 3 });
    });`,
  } }
}

/** Durable concurrent jobs in one Bun process. A replacement process resumes unfinished jobs. */
export class VideoService {
  private db: Database
  private listeners = new Map<string, Set<(manifest: VideoManifest | null) => void>>()
  private stopped = false
  private abort = new AbortController()
  private active = new Map<string, { abort: AbortController; work: Promise<void> }>()

  constructor(path: string, private generate: Generator = simulatedGenerator, private provider: VideoManifest['provider'] = 'simulated', private generateThumbnail?: ThumbnailGenerator) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT NOT NULL, request TEXT NOT NULL, manifest TEXT NOT NULL, UNIQUE(owner,key));
      CREATE TABLE IF NOT EXISTS video_audio (video TEXT NOT NULL, scene TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(video,scene));
      CREATE TABLE IF NOT EXISTS video_uploads (video TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, text TEXT, PRIMARY KEY(video,position));
      CREATE TABLE IF NOT EXISTS scene_requests (video TEXT PRIMARY KEY, lesson TEXT NOT NULL, key TEXT NOT NULL, input TEXT NOT NULL, after_scene TEXT NOT NULL, UNIQUE(lesson,key));`)
    this.kick()
  }

  private row(id: string) { return this.db.query('SELECT * FROM videos WHERE id = ?').get(id) as Row | null }
  get(id: string, owner: string): VideoManifest | undefined {
    const row = this.row(id)
    return row?.owner === owner ? publicManifest(JSON.parse(row.manifest)) : undefined
  }
  list(owner?: string): VideoManifest[] {
    const rows = owner === undefined ? this.db.query('SELECT manifest FROM videos WHERE id NOT IN (SELECT video FROM scene_requests) ORDER BY rowid DESC').all() : this.db.query('SELECT manifest FROM videos WHERE owner = ? AND id NOT IN (SELECT video FROM scene_requests) ORDER BY rowid DESC').all(owner)
    return (rows as { manifest: string }[]).map(row => publicManifest(JSON.parse(row.manifest)))
  }
  create(owner: string, key: string, request: VideoRequest, uploads: Upload[] = []): VideoManifest {
    // New videos always support interaction, including requests from older clients.
    const { videoMode: _videoMode, ...content } = request
    request = { ...content, videoMode: 'interactive' }
    const prior = this.db.query('SELECT * FROM videos WHERE owner = ? AND key = ?').get(owner, key) as Row | null
    if (prior) {
      // Compare the effective request without rewriting an existing job's saved policy.
      const { videoMode: _priorMode, ...priorContent } = JSON.parse(prior.request)
      if (JSON.stringify(priorContent) !== JSON.stringify(content)) throw new Error('Idempotency key already used for a different request')
      return publicManifest(JSON.parse(prior.manifest))
    }
    const manifest: VideoManifest = { schemaVersion: 1, id: crypto.randomUUID(), title: request.title, revision: 0, status: 'queued', provider: this.provider, ...(request.narrationMode ? { narrationMode: request.narrationMode } : {}), createdAt: new Date().toISOString(), scenes: [], ...(this.provider !== 'simulated' ? { tokenUsage: emptyTokenUsage() } : {}) }
    this.db.transaction(() => {
      this.db.query('INSERT INTO videos VALUES (?, ?, ?, ?, ?)').run(manifest.id, owner, key, JSON.stringify(request), JSON.stringify(manifest))
      uploads.forEach((upload, index) => this.db.query('INSERT INTO video_uploads VALUES (?, ?, ?, ?, ?, NULL)').run(manifest.id, index, upload.name, upload.mimeType, upload.bytes))
    })()
    logEvent('video.queued', { videoId: manifest.id })
    this.kick()
    return manifest
  }
  sceneRequests(lesson: string): SceneRequest[] {
    const rows = this.db.query('SELECT r.video, r.after_scene, r.input, v.manifest FROM scene_requests r JOIN videos v ON v.id = r.video WHERE r.lesson = ? ORDER BY r.rowid').all(lesson) as { video: string; after_scene: string; input: string; manifest: string }[]
    return rows.map(row => ({ id: row.video, afterSceneId: row.after_scene, question: (JSON.parse(row.input) as SceneRequestInput).question, video: publicManifest(JSON.parse(row.manifest)) }))
  }
  private createSceneRequest(lesson: string, key: string, input: SceneRequestInput): SceneRequest {
    const prior = this.db.query('SELECT * FROM scene_requests WHERE lesson = ? AND key = ?').get(lesson, key) as { input: string; video: string } | null
    if (prior) {
      if (prior.input !== JSON.stringify(input)) throw new Error('Idempotency key already used for a different request')
      return this.sceneRequests(lesson).find(request => request.id === prior.video)!
    }
    const row = this.row(lesson)
    const parent: VideoManifest | undefined = row ? JSON.parse(row.manifest) : undefined
    const existing = this.sceneRequests(lesson)
    if (existing.length >= 20 || (parent?.scenes.length ?? 1) + existing.reduce((sum, r) => sum + Math.max(1, r.video.scenes.length), 0) + 1 > 100) throw new Error('This lesson has reached its added-scene limit.')
    const after = input.context.scene!.id!
    let selected = parent?.scenes.find(scene => scene.id === after)
    let next = parent?.scenes[(parent?.scenes.findIndex(scene => scene.id === after) ?? -1) + 1]
    for (const request of existing) {
      const index = request.video.scenes.findIndex(scene => insertedSceneId(request.id, scene.id) === after)
      if (index >= 0) { selected = request.video.scenes[index]; next = request.video.scenes[index + 1]; break }
    }
    if (!selected && !parent) {
      const local = input.localScene
      if (local?.id === after && typeof local.source === 'string' && local.source.length <= 100_000 && Number.isFinite(local.duration) && local.duration > 0) {
        selected = { ...local, index: 0, audio: { id: '', url: '' }, captions: [] }
      }
    }
    if (!selected || input.context.scene!.time > selected.duration + 0.1) throw new Error('The selected scene is unavailable. Reload the lesson and try again.')
    const original: VideoRequest | undefined = row ? JSON.parse(row.request) : undefined
    const request = contextualVideoRequest(input, selected, original, next)
    if (Buffer.byteLength(JSON.stringify(request)) > 1_000_000) throw new Error('This scene contains too much context. Try a simpler moment.')
    const video = this.db.transaction(() => {
      const video = this.create(SHARED_OWNER, `scene-request:${crypto.randomUUID()}`, request)
      this.db.query('INSERT INTO scene_requests VALUES (?, ?, ?, ?, ?)').run(video.id, lesson, key, JSON.stringify(input), after)
      // Preserve original document/photo inputs for the generation worker.
      if (row) this.db.query('INSERT INTO video_uploads SELECT ?, position, name, mime, bytes, text FROM video_uploads WHERE video = ?').run(video.id, lesson)
      return video
    })()
    return { id: video.id, afterSceneId: after, question: input.question, video }
  }
  delete(id: string): boolean {
    if (!this.row(id)) return false
    for (const child of this.sceneRequests(id)) this.delete(child.id)
    this.active.get(id)?.abort.abort()
    this.db.transaction(() => {
      this.db.query('DELETE FROM video_audio WHERE video = ?').run(id)
      this.db.query('DELETE FROM video_uploads WHERE video = ?').run(id)
      this.db.query('DELETE FROM videos WHERE id = ?').run(id)
      this.db.query('DELETE FROM scene_requests WHERE video = ? OR lesson = ?').run(id, id)
    })()
    for (const listener of this.listeners.get(id) ?? []) listener(null)
    logEvent('video.deleted', { videoId: id })
    return true
  }
  private async sources(row: Row, signal: AbortSignal) {
    const request: VideoRequest = JSON.parse(row.request)
    const images: ImageContent[] = []
    const uploads = this.db.query('SELECT * FROM video_uploads WHERE video = ? ORDER BY position').all(row.id) as { position: number; name: string; mime: string; bytes: Uint8Array; text: string | null }[]
    for (const upload of uploads) {
      signal.throwIfAborted()
      if (upload.mime.startsWith('image/')) images.push({ type: 'image', mimeType: upload.mime, data: Buffer.from(upload.bytes).toString('base64') })
      else {
        const text = upload.text ?? await extractUpload({ name: upload.name, mimeType: upload.mime, bytes: upload.bytes })
        signal.throwIfAborted()
        if (upload.text === null) this.db.query('UPDATE video_uploads SET text = ? WHERE video = ? AND position = ?').run(text, row.id, upload.position)
        request.documents.push({ name: upload.name, text })
      }
    }
    return { request, images }
  }
  private save(manifest: VideoManifest) {
    manifest.revision++
    this.db.query('UPDATE videos SET manifest = ? WHERE id = ?').run(JSON.stringify(manifest), manifest.id)
  }
  private notify(manifest: VideoManifest) {
    for (const listener of this.listeners.get(manifest.id) ?? []) listener(manifest)
  }
  private async thumbnail(manifest: VideoManifest, request: VideoRequest, context: { signal: AbortSignal; images: ImageContent[] }) {
    if (request.sceneRequest || !this.generateThumbnail || manifest.provider !== 'pi' || manifest.thumbnail || manifest.thumbnailStatus === 'failed') return
    manifest.thumbnailStatus = 'generating'; this.save(manifest); this.notify(manifest)
    try {
      const artwork = await logStage({ videoId: manifest.id, stage: 'thumbnail' }, () => this.generateThumbnail!(request, context))
      if (context.signal.aborted || !this.row(manifest.id)) return
      manifest.thumbnail = artwork; manifest.thumbnailStatus = 'complete'
    } catch (error) {
      if (context.signal.aborted || !this.row(manifest.id)) return
      manifest.thumbnailStatus = 'failed'
      logEvent('thumbnail.failed', { videoId: manifest.id, code: error instanceof AgentError ? error.code : 'THUMBNAIL' }, 'warn')
    }
    this.save(manifest); this.notify(manifest)
  }
  private kick() {
    if (this.stopped) return
    const rows = this.db.query("SELECT * FROM videos WHERE json_extract(manifest, '$.status') IN ('queued','generating') ORDER BY rowid").all() as Row[]
    for (const row of rows) {
      if (this.active.has(row.id)) continue
      const abort = new AbortController()
      // Register before starting so repeated kicks cannot launch the same job twice.
      const work = Promise.resolve().then(() => {
        if (this.stopped || !this.row(row.id)) return
        return this.run(row, abort)
      }).finally(() => { this.active.delete(row.id) })
      this.active.set(row.id, { abort, work })
    }
  }
  private async run(row: Row, abort: AbortController) {
    const manifest: VideoManifest = JSON.parse(row.manifest)
    const models: import('animlib/core').CompileInput['models'] = Object.create(null)
    for (const scene of manifest.scenes) for (const [id, asset] of Object.entries(scene.assets ?? {})) models![id] = asset.metadata
    const sequence = new SceneSequence({ models })
    const signal = AbortSignal.any([this.abort.signal, abort.signal])
    const usage = new TokenUsageTracker(tokenUsage => {
      if (!this.row(row.id)) return
      manifest.tokenUsage = tokenUsage; this.save(manifest); this.notify(manifest)
    }, manifest.tokenUsage)
    const started = performance.now()
    logEvent('video.started', { videoId: manifest.id, sceneCount: manifest.scenes.length, resumed: manifest.status === 'generating' })
    let thumbnailWork: Promise<void> | undefined
    try {
      if (manifest.provider === 'pi' && this.provider !== 'pi') throw new AgentError('CONFIG', 'This video requires VIDEO_GENERATOR=pi.')
      const generate = manifest.provider === 'simulated' && this.provider === 'pi' ? simulatedGenerator : this.generate
      manifest.status = 'generating'; this.save(manifest); this.notify(manifest)
      const { request: input, images } = await logStage({ videoId: manifest.id, stage: 'sources' }, () => this.sources(row, signal))
      if (input.sceneRequest) {
        const link = this.db.query('SELECT lesson FROM scene_requests WHERE video = ?').get(manifest.id) as { lesson: string } | null
        if (link) {
          const parent = this.row(link.lesson)
          const baseCount = parent ? (JSON.parse(parent.manifest) as VideoManifest).scenes.length : 1
          const otherCount = this.sceneRequests(link.lesson).filter(r => r.id !== manifest.id).reduce((sum, r) => sum + Math.max(1, r.video.scenes.length), 0)
          if (baseCount + otherCount + 1 > 100) throw new AgentError('LIMIT', 'This lesson has reached its added-scene limit.')
        }
      }
      thumbnailWork = withTokenUsage(usage, () => this.thumbnail(manifest, input, { signal, images }))
      const initial = await sequence.submit({ type: 'load', scenes: manifest.scenes })
      if (!initial.ok) throw new Error('Stored scenes could not be restored')
      while (!this.stopped) {
        const priorIndex = manifest.scenes.length - 1
        const previousFrame = priorIndex >= 0 ? await sequence.evaluate(priorIndex, manifest.scenes[priorIndex].duration) : undefined
        const next = input.sceneRequest && manifest.scenes.length >= 1 ? null : await withTokenUsage(usage, () => generate(input, manifest.scenes.length, { videoId: manifest.id, owner: row.owner,
          previousFrame, signal, images }))
        if (this.stopped || !this.row(row.id)) break
        if (!next) {
          await thumbnailWork
          if (this.stopped || !this.row(row.id)) break
          usage.flush(); manifest.status = 'complete'; this.save(manifest); this.notify(manifest)
          logEvent('video.completed', { videoId: manifest.id, sceneCount: manifest.scenes.length, elapsedMs: Math.round(performance.now() - started) })
          break
        }
        const scene: VideoScene = { ...next.scene, audio: { id: next.scene.audio?.id ?? `audio-${next.scene.index}`, url: `/api/videos/${manifest.id}/audio/${next.scene.id}` } }
        if (scene.index !== manifest.scenes.length || !Number.isFinite(scene.duration) || scene.duration <= 0) throw new Error('Invalid generated scene order or duration')
        for (const [id, asset] of Object.entries(scene.assets ?? {})) models![id] = asset.metadata
        const result = await sequence.submit({ type: 'insert', after: manifest.scenes.at(-1)?.id ?? null, scenes: [scene] })
        if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('; '))
        if (Math.abs(sequence.compiled.at(-1)!.duration - scene.duration) > 1e-6) throw new Error('Scene timing does not match its declared duration')
        signal.throwIfAborted()
        // Publish the scene and its asset atomically before sending an event.
        this.db.transaction(() => {
          this.db.query('INSERT INTO video_audio VALUES (?, ?, ?)').run(manifest.id, scene.id, next.audio)
          manifest.scenes.push(scene); this.save(manifest)
        })()
        this.notify(manifest)
        logEvent('video.scene_published', { videoId: manifest.id, sceneIndex: scene.index, sceneCount: manifest.scenes.length, elapsedMs: Math.round(performance.now() - started) })
      }
    } catch (error) {
      await thumbnailWork
      if (this.stopped || !this.row(row.id)) return
      usage.flush(); manifest.status = 'failed'; manifest.errorCode = error instanceof AgentError ? error.code : 'GENERATION'
      manifest.error = videoFailureMessage(manifest.errorCode, manifest.scenes.length > 0)
      logEvent('video.failed', { videoId: manifest.id, sceneCount: manifest.scenes.length, code: error instanceof AgentError ? error.code : 'GENERATION', elapsedMs: Math.round(performance.now() - started) }, 'error')
      this.save(manifest); this.notify(manifest)
    } finally {
      await thumbnailWork
      if (this.stopped) logEvent('video.interrupted', { videoId: manifest.id, sceneCount: manifest.scenes.length, elapsedMs: Math.round(performance.now() - started) })
      usage.flush(); sequence.dispose()
    }
  }
  async close() {
    this.stopped = true; this.abort.abort()
    await Promise.all([...this.active.values()].map(job => job.work))
    this.db.close()
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), parts = url.pathname.split('/')
    const owner = SHARED_OWNER
    const headers = new Headers({ 'Cache-Control': 'no-store' })
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
    if (request.method === 'POST' || request.method === 'DELETE') {
      const origin = request.headers.get('origin')
      const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)
      const publicOrigin = process.env.NARRATION_PUBLIC_ORIGIN ?? `${protocol}://${url.host}`
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== publicOrigin)) return json({ detail: 'Invalid origin' }, 403)
    }
    if (parts.length === 3) {
      if (request.method === 'GET') return json(this.list())
      if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405)
      const key = request.headers.get('Idempotency-Key')
      if (!key || key.length > 128) return json({ detail: 'An Idempotency-Key is required' }, 400)
      const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data')
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []
      if (reader) while (true) {
        const { value, done } = await reader.read(); if (done) break
        chunks.push(value)
      }
      let body: VideoRequest
      const uploads: Upload[] = []
      try {
        const blob = new Blob(chunks.map(chunk => new Uint8Array(chunk)))
        if (multipart) {
          const form = await new Response(blob, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData()
          const payload = form.get('request')
          if (typeof payload !== 'string') return json({ detail: 'Provide request JSON with your files' }, 400)
          body = JSON.parse(payload)
          const files = form.getAll('files')
          for (const file of files) {
            if (typeof file === 'string' || !file.name || file.name.length > 255) return json({ detail: 'Provide named files' }, 400)
            const mimeType = uploadType(file.name)
            if (!mimeType) return json({ detail: 'Choose PDF, DOCX, TXT, Markdown, PNG, JPEG, or WebP files' }, 415)
            if (!file.size) return json({ detail: 'Provide nonempty files' }, 400)
            uploads.push({ name: file.name, mimeType, bytes: new Uint8Array(await file.arrayBuffer()) })
          }
        } else body = JSON.parse(await blob.text())
      } catch { return json({ detail: 'Invalid request body' }, 400) }
      if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || typeof body.topic !== 'string' || !Array.isArray(body.documents) || body.documents.some(d => !d || typeof d.name !== 'string' || typeof d.text !== 'string') || (!body.topic.trim() && !body.documents.some(d => d.text.trim()) && !uploads.length)) return json({ detail: 'Provide a title and topic, document text, or files' }, 400)
      if (body.videoMode !== undefined && body.videoMode !== 'classic' && body.videoMode !== 'interactive') return json({ detail: 'Choose classic or interactive video mode' }, 400)
      if (body.narrationMode !== undefined && !['speech', 'subtitles'].includes(body.narrationMode)) return json({ detail: 'Choose speech or subtitles' }, 400)
      const normalized: VideoRequest = { title: body.title.trim(), topic: body.topic, documents: body.documents.map(d => ({ name: d.name, text: d.text })),
        ...(body.narrationMode !== undefined ? { narrationMode: body.narrationMode } : {}),
        ...(body.videoMode !== undefined ? { videoMode: body.videoMode } : {}),
        ...(uploads.length ? { uploads: uploads.map(uploadMetadata) } : {}) }
      try { return json(this.create(owner, key, normalized, uploads), 202) } catch (error) { return json({ detail: (error as Error).message }, 409) }
    }
    if (parts.length === 5 && parts[4] === 'scene-requests') {
      let lesson: string
      try { lesson = decodeURIComponent(parts[3]) } catch { return json({ detail: 'Invalid lesson ID' }, 400) }
      if (!lesson || lesson.length > 256) return json({ detail: 'Invalid lesson ID' }, 400)
      if (request.method === 'GET') return json(this.sceneRequests(lesson))
      if (request.method !== 'POST') return json({ detail: 'Method Not Allowed' }, 405)
      const key = request.headers.get('Idempotency-Key')
      if (!key || key.length > 128) return json({ detail: 'An Idempotency-Key is required' }, 400)
      const reader = request.body?.getReader(), chunks: Uint8Array[] = []
      let size = 0
      if (reader) while (true) {
        const { value, done } = await reader.read(); if (done) break
        size += value.length
        if (size > 1_000_000) { await reader.cancel(); return json({ detail: 'Scene context must be under 1 MB' }, 413) }
        chunks.push(value)
      }
      let input: SceneRequestInput
      try { input = validateSceneRequest(JSON.parse(await new Blob(chunks.map(chunk => new Uint8Array(chunk))).text()), lesson) }
      catch (error) { return json({ detail: error instanceof SyntaxError ? 'Invalid request body' : (error as Error).message }, 400) }
      try { return json(this.createSceneRequest(lesson, key, input), 202) }
      catch (error) { return json({ detail: (error as Error).message }, 409) }
    }
    // All visitors share the library, including jobs saved under earlier session identities.
    const row = this.row(parts[3])
    const manifest: VideoManifest | undefined = row ? publicManifest(JSON.parse(row.manifest)) : undefined
    if (!manifest) return json({ detail: 'Not Found' }, 404)
    if (parts.length === 4 && request.method === 'DELETE') { this.delete(manifest.id); return new Response(null, { status: 204, headers }) }
    if (request.method !== 'GET') return json({ detail: 'Method Not Allowed' }, 405)
    if (parts.length === 4) return json(manifest)
    if (parts.length === 6 && parts[4] === 'audio') {
      const asset = this.db.query('SELECT bytes FROM video_audio WHERE video = ? AND scene = ?').get(manifest.id, parts[5]) as { bytes: Uint8Array } | null
      if (!asset) return json({ detail: 'Not Found' }, 404)
      headers.set('Content-Type', 'audio/wav'); headers.set('Cache-Control', 'private, max-age=31536000, immutable')
      return new Response(new Uint8Array(asset.bytes), { headers })
    }
    if (parts.length !== 5 || parts[4] !== 'events') return json({ detail: 'Not Found' }, 404)
    // Each event is an authoritative snapshot. Reconnect needs no unbounded replay log.
    let cleanup = () => {}
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        const encoder = new TextEncoder()
        let closed = false
        const listeners = this.listeners.get(manifest.id) ?? new Set()
        this.listeners.set(manifest.id, listeners)
        const heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n')) }, 10_000)
        const abort = () => { cleanup(); try { controller.close() } catch { /* already cancelled */ } }
        cleanup = () => {
          closed = true; clearInterval(heartbeat); listeners.delete(send)
          if (!listeners.size) this.listeners.delete(manifest.id)
          request.signal.removeEventListener('abort', abort)
        }
        const send = (snapshot: VideoManifest | null) => {
          if (closed) return
          if (!snapshot) { controller.enqueue(encoder.encode('event: deleted\ndata: {}\n\n')); abort(); return }
          snapshot = publicManifest(snapshot)
          controller.enqueue(encoder.encode(`id: ${snapshot.revision}\nevent: manifest\ndata: ${JSON.stringify(snapshot)}\n\n`))
          if (snapshot.status === 'complete' || snapshot.status === 'failed') abort()
        }
        listeners.add(send); request.signal.addEventListener('abort', abort, { once: true })
        if (request.signal.aborted) abort(); else send(manifest)
      },
      cancel: () => cleanup(),
    })
    headers.set('Content-Type', 'text/event-stream'); headers.set('X-Accel-Buffering', 'no')
    return new Response(stream, { headers })
  }
}
