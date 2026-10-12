import type { Player, PlayerState, SceneSource } from 'animlib'
import type { SceneRequest } from '../../../shared/video/scene-requests'
import { sceneRequestTimeline, sceneRequestBarriers } from './sceneRequests.ts'
import type { TimelineScene } from './sceneRequests.ts'
import type { VideoManifest } from '../../../shared/video/contract'

type AnimationPlayer = Pick<Player, 'submit' | 'seek' | 'play' | 'pause' | 'subscribe' | 'dispose'> & Partial<Pick<Player, 'registerAssets' | 'unlockAudio' | 'setSceneBarriers'>>
export interface LessonPlaybackState {
  time: number
  sceneId?: string
  sceneTime?: number
  duration: number
  playing: boolean
  ended: boolean
  ready: boolean
  error: string
  buffering?: boolean
  waitingForInsertion?: boolean
  generating?: boolean
  generationError?: string
  insertionError?: string
  wantsPlay?: boolean
}

export function sequenceTime(state: PlayerState): number {
  let offset = 0
  for (const scene of state.scenes) {
    if (scene.id === state.scene) return offset + state.time
    offset += scene.duration
  }
  return 0
}

export function scenePosition(scenes: PlayerState['scenes'], time: number) {
  let remaining = Math.max(0, time)
  for (const [index, scene] of scenes.entries()) {
    if (remaining < scene.duration || index === scenes.length - 1) {
      return { scene: scene.id, time: Math.min(remaining, scene.duration) }
    }
    remaining -= scene.duration
  }
  throw new Error('This lesson has no animation scenes.')
}

// Keeps user playback intent separate from temporary pauses caused by overlays.
// Animlib owns the clock; this adapter only maps it onto the app's controls.
export class LessonPlayback {
  private state: LessonPlaybackState = { time: 0, duration: 0, playing: false, ended: false, ready: false, error: '' }
  private scenes: PlayerState['scenes'] = []
  private listeners = new Set<() => void>()
  private wantsPlay = true
  private suspended = false
  private disposed = false
  private operations: Promise<void> = Promise.resolve()
  private unsubscribe: () => void
  private player: AnimationPlayer
  private complete = true
  private manifestRevision = -1
  private extendingBoundary = Infinity
  private baseSources: TimelineScene[] = []
  private requests: SceneRequest[] = []
  private changingTimeline = false
  private currentPosition = { scene: '', time: 0 }
  private barriers = new Set<string>()
  private unavailable = new Set<string>()
  private heldForInsertion?: string

  constructor(player: AnimationPlayer, autoplay = true) {
    this.player = player
    this.wantsPlay = autoplay
    this.unsubscribe = player.subscribe(state => {
      if (this.disposed) return
      this.scenes = state.scenes
      this.currentPosition = { scene: state.scene ?? '', time: state.time }
      const duration = state.scenes.reduce((total, scene) => total + scene.duration, 0)
      const time = sequenceTime(state)
      const atEdge = duration > 0 && time >= duration
      const waitingForInsertion = this.barriers.has(state.scene ?? '') && state.time >= state.duration
      if (waitingForInsertion) this.heldForInsertion = state.scene ?? undefined
      else if (this.heldForInsertion !== state.scene || state.time < state.duration) this.heldForInsertion = undefined
      const ended = this.complete && atEdge && !waitingForInsertion
      const waitingAtAppend = time >= this.extendingBoundary
      if (!this.changingTimeline && !waitingForInsertion && (ended || state.status === 'ended' && !waitingAtAppend && (!atEdge || this.complete) || state.status === 'blocked')) this.wantsPlay = false
      this.update({
        time, duration, sceneId: state.scene ?? undefined, sceneTime: state.time,
        playing: state.status === 'playing', ended, error: state.error ?? '',
        buffering: waitingForInsertion || !this.complete && (atEdge || !duration), waitingForInsertion, wantsPlay: this.wantsPlay,
      })
    })
  }

  getState = () => this.state
  hasScene = (id: string) => this.scenes.some(scene => scene.id === id)
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private update(change: Partial<LessonPlaybackState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...change }
    this.listeners.forEach(listener => listener())
  }

  private async syncPlayback() {
    if (this.disposed || !this.state.ready) return
    if (this.heldForInsertion && this.currentPosition.scene === this.heldForInsertion && !this.barriers.has(this.heldForInsertion)) {
      const next = this.scenes[this.scenes.findIndex(scene => scene.id === this.heldForInsertion) + 1]
      this.heldForInsertion = undefined
      if (next) await this.player.seek({ scene: next.id, time: 0 })
    }
    const current = this.scenes.find(scene => scene.id === this.currentPosition.scene)
    const waitingForInsertion = !!current && this.barriers.has(current.id) && this.currentPosition.time >= current.duration
    if (waitingForInsertion) this.heldForInsertion = current!.id
    const atEdge = this.state.duration > 0 && this.state.time >= this.state.duration
    const ended = this.complete && atEdge && !waitingForInsertion
    if (ended) this.wantsPlay = false
    this.update({ waitingForInsertion, ended, buffering: waitingForInsertion || !this.complete && (atEdge || !this.state.ready), wantsPlay: this.wantsPlay })
    if (this.state.buffering) { if (this.state.playing) this.player.pause(); return }
    if (this.wantsPlay && !this.suspended) { if (!this.state.playing) await this.player.play() }
    else if (this.state.playing) this.player.pause()
  }

  private run(operation: () => Promise<void>) {
    this.operations = this.operations.then(async () => {
      if (!this.disposed) await operation()
    }).catch(error => {
      if (!this.disposed) {
        this.wantsPlay = false
        this.update({ playing: false, error: error instanceof Error ? error.message : String(error) })
      }
    })
    return this.operations
  }

  load(sources: SceneSource[], initialTime = 0) {
    return this.run(async () => {
      this.baseSources = sources.map((scene, index) => ({ ...scene, handoffFrom: index ? sources[index - 1].id : null }))
      const result = await this.player.submit({ type: 'load', scenes: this.baseSources })
      if (this.disposed) return
      if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('\n'))
      await this.player.seek(scenePosition(this.scenes, initialTime))
      if (this.disposed) return
      this.update({ ready: true })
      await this.syncPlayback()
    })
  }

  acceptManifest(manifest: VideoManifest) {
    return this.run(async () => {
      if (manifest.schemaVersion !== 1) throw new Error('Unsupported video format')
      if (manifest.revision <= this.manifestRevision) return
      this.complete = false
      this.update({ generating: manifest.status === 'generating' || manifest.status === 'queued', generationError: manifest.error })
      if (manifest.scenes.some((scene, index) => scene.index !== index)) throw new Error('Video scenes arrived out of order')
      this.baseSources = manifest.scenes.map((scene, index) => ({ ...scene, audioId: `base:${scene.audio.id}`, handoffFrom: index ? manifest.scenes[index - 1].id : null }))
      await this.reconcileTimeline()
      this.complete = manifest.status === 'complete' || manifest.status === 'failed'
      this.manifestRevision = manifest.revision
      const atEdge = this.state.duration > 0 && this.state.time >= this.state.duration
      if (this.complete && atEdge && !this.state.waitingForInsertion) this.wantsPlay = false
      await this.syncPlayback()
    })
  }

  private updateBarriers() {
    this.barriers = sceneRequestBarriers(this.baseSources, this.requests, new Set(this.scenes.map(scene => scene.id)), this.unavailable)
    this.player.setSceneBarriers?.([...this.barriers])
    const current = this.scenes.find(scene => scene.id === this.currentPosition.scene)
    if (current && this.barriers.has(current.id) && this.currentPosition.time >= current.duration) this.heldForInsertion = current.id
  }

  private async reconcileTimeline() {
    const desired = sceneRequestTimeline(this.baseSources, this.requests)
    let insertionError = ''
    let after: string | null = null
    const unavailable = this.unavailable = new Set<string>()
    this.updateBarriers()
    for (const scene of desired) {
      if (this.scenes.some(existing => existing.id === scene.id)) { after = scene.id; continue }
      const original = this.baseSources.some(base => base.id === scene.id)
      const request = this.requests.find(r => r.video.scenes.some(s => `${r.id}:${s.id}` === scene.id))
      if (request && (unavailable.has(request.afterSceneId) || scene.handoffFrom && unavailable.has(scene.handoffFrom))) {
        unavailable.add(scene.id); continue
      }
      const append = after === (this.scenes.at(-1)?.id ?? null)
      const boundary = this.state.duration
      // Insertion can recompile later scenes. Freeze and restore the current moment,
      // while preserving the user's play/pause intent and all current control values.
      if (!append) this.player.pause()
      const position = { ...this.currentPosition }
      if (scene.audio) this.player.registerAssets?.({ ...scene.assets, [scene.audioId!]: { kind: 'audio', url: scene.audio.url } })
      this.extendingBoundary = append ? boundary || Infinity : Infinity
      this.changingTimeline = true
      try {
        const result = await this.player.submit({ type: 'insert', after, scenes: [scene] })
        if (this.disposed) return
        if (!result.ok) throw new Error(result.diagnostics.map(d => d.message).join('\n'))
        if (!append && position.scene) await this.player.seek(position)
        else if (!this.heldForInsertion && boundary > 0 && this.state.time >= boundary) await this.player.seek(scenePosition(this.scenes, boundary))
      } catch (error) {
        if (original) throw error
        // Skip failed additions and their dependents, so later original scenes still arrive.
        insertionError = error instanceof Error ? error.message : String(error)
        unavailable.add(scene.id)
        continue
      } finally { this.extendingBoundary = Infinity; this.changingTimeline = false }
      after = scene.id
      this.updateBarriers()
      this.update({ ready: true })
      await this.syncPlayback()
    }
    this.updateBarriers()
    this.update({ insertionError })
    await this.syncPlayback()
  }

  acceptSceneRequests(requests: SceneRequest[]) {
    return this.run(async () => {
      this.requests = requests
      try {
        await this.reconcileTimeline()
      } catch (error) {
        // A failed addition must leave the existing lesson playable.
        this.update({ insertionError: error instanceof Error ? error.message : String(error) })
        await this.syncPlayback()
      }
    })
  }

  playScene(scene: string) {
    void this.player.unlockAudio?.().catch(error => this.update({ insertionError: String(error) }))
    return this.run(async () => {
      if (!this.scenes.some(existing => existing.id === scene)) return
      this.wantsPlay = true
      await this.player.seek({ scene, time: 0 })
      this.update({ wantsPlay: true })
      await this.syncPlayback()
    })
  }

  toggle() {
    if (!this.state.ready || this.state.error || this.suspended) return Promise.resolve()
    if (!this.wantsPlay) void this.player.unlockAudio?.().catch(error => this.update({ error: String(error) }))
    if (this.state.ended) return this.restart()
    this.wantsPlay = !this.wantsPlay
    this.update({ wantsPlay: this.wantsPlay })
    // Stop immediately, even if a prior seek is still queued.
    if (!this.wantsPlay) this.player.pause()
    return this.run(() => this.syncPlayback())
  }

  seek(time: number) {
    if (!this.state.ready || this.state.error) return Promise.resolve()
    return this.run(async () => {
      await this.player.seek(scenePosition(this.scenes, time))
      if (this.disposed) return
      if (time >= this.state.duration && this.complete && !this.state.waitingForInsertion) this.wantsPlay = false
      await this.syncPlayback()
    })
  }

  restart() {
    if (!this.state.ready || this.state.error) return Promise.resolve()
    this.wantsPlay = true
    return this.seek(0)
  }

  setSuspended(suspended: boolean) {
    this.suspended = suspended
    if (suspended && this.state.ready) this.player.pause()
    return this.run(() => this.syncPlayback())
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
    this.player.dispose()
  }
}
