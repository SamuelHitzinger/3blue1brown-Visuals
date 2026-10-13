import type { Asset, SceneSource } from 'animlib'
import type { SceneRequest, SceneRequestInput } from '../../../shared/video/scene-requests.ts'
import { insertedSceneId } from '../../../shared/video/scene-requests.ts'

async function responseJSON<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail ?? 'Could not add scenes. Please try again.')
  return body
}
export const listSceneRequests = (lessonId: string, signal?: AbortSignal) => fetch(`/api/videos/${encodeURIComponent(lessonId)}/scene-requests`, { signal }).then(responseJSON<SceneRequest[]>)
/** Retain newer SSE/local submissions when an older list response arrives. */
export function mergeSceneRequests(current: SceneRequest[], saved: SceneRequest[]): SceneRequest[] {
  const known = new Map(current.map(request => [request.id, request]))
  const incoming = new Set(saved.map(request => request.id))
  const merged = [...saved.map(request => {
    const previous = known.get(request.id)
    return previous && previous.video.revision >= request.video.revision ? previous : request
  }), ...current.filter(request => !incoming.has(request.id))]
  return merged.length === current.length && merged.every((request, index) => request === current[index]) ? current : merged
}

/** Discover requests made in other tabs when the viewer returns, without polling. */
export function watchSceneRequestList(lessonId: string, onRequests: (requests: SceneRequest[]) => void, onConnection: (message: string) => void) {
  let active = true, refreshing = false, refreshAgain = false
  const abort = new AbortController()
  const refresh = async () => {
    if (!active) return
    if (refreshing) { refreshAgain = true; return }
    refreshing = true
    try {
      const saved = await listSceneRequests(lessonId, abort.signal)
      if (active) { onRequests(saved); onConnection('') }
    } catch { if (active) onConnection('Could not load added scenes. Return to this tab or reload to try again.') }
    finally {
      refreshing = false
      if (active && refreshAgain) { refreshAgain = false; void refresh() }
    }
  }
  const visible = () => { if (document.visibilityState === 'visible') void refresh() }
  window.addEventListener('focus', visible)
  document.addEventListener('visibilitychange', visible)
  void refresh()
  return () => {
    active = false; abort.abort()
    window.removeEventListener('focus', visible)
    document.removeEventListener('visibilitychange', visible)
  }
}
export const requestScenes = (input: SceneRequestInput, key: string) => fetch(`/api/videos/${encodeURIComponent(input.context.lessonId)}/scene-requests`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(input),
}).then(responseJSON<SceneRequest>)

export interface TimelineScene extends SceneSource { audio?: { id: string; url: string }; assets?: Record<string, Asset>; requestId?: string }
type TimelineEntry = TimelineScene | { waitingFor: string }

/** Attach each group after its captured scene; nested requests stay next to their target. */
function sceneRequestEntries(base: TimelineScene[], requests: SceneRequest[]): TimelineEntry[] {
  const additions = new Map<string, { request: SceneRequest; scenes: TimelineScene[] }[]>()
  for (const request of requests) {
    const group = request.video.scenes.map((scene, index) => ({
      ...scene, id: insertedSceneId(request.id, scene.id), requestId: request.id,
      audioId: `${request.id}:${scene.audio.id}`,
      handoffFrom: index ? insertedSceneId(request.id, request.video.scenes[index - 1].id) : null,
    }))
    additions.set(request.afterSceneId, [...(additions.get(request.afterSceneId) ?? []), { request, scenes: group }])
  }
  const timeline: TimelineEntry[] = [], seen = new Set<string>()
  const visit = (scenes: TimelineScene[]) => {
    for (const scene of scenes) {
      if (seen.has(scene.id)) continue
      seen.add(scene.id); timeline.push(scene)
      for (const group of additions.get(scene.id) ?? []) {
        visit(group.scenes)
        if (group.request.video.status === 'queued' || group.request.video.status === 'generating') timeline.push({ waitingFor: group.request.id })
      }
    }
  }
  visit(base)
  return timeline
}

export function sceneRequestTimeline(base: TimelineScene[], requests: SceneRequest[]): TimelineScene[] {
  return sceneRequestEntries(base, requests).filter((entry): entry is TimelineScene => !('waitingFor' in entry))
}

/** A missing scene or unfinished group holds the last prepared scene before it. */
export function sceneRequestBarriers(base: TimelineScene[], requests: SceneRequest[], prepared: Set<string>, unavailable = new Set<string>()) {
  const barriers = new Set<string>(), failedRequests = new Set<string>()
  let previous: string | undefined
  for (const entry of sceneRequestEntries(base, requests)) {
    if ('waitingFor' in entry) {
      if (previous && !failedRequests.has(entry.waitingFor)) barriers.add(previous)
    } else if (unavailable.has(entry.id)) {
      if (entry.requestId) failedRequests.add(entry.requestId)
    } else if (prepared.has(entry.id)) previous = entry.id
    else if (previous) barriers.add(previous)
  }
  return barriers
}
