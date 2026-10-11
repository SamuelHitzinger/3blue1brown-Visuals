import type { VideoManifest, VideoRequest } from '../../../shared/video/contract'
import type { Lesson } from './data'

// Library requests already contain immutable scene sources. Reuse a bounded set
// for immediate startup, while SSE still revalidates every opened lesson.
const recentVideos = new Map<string, VideoManifest>()
function rememberVideo(video: VideoManifest): VideoManifest {
  const previous = recentVideos.get(video.id)
  const latest = previous && previous.revision > video.revision ? previous : video
  recentVideos.delete(video.id)
  recentVideos.set(video.id, latest)
  if (recentVideos.size > 32) recentVideos.delete(recentVideos.keys().next().value!)
  return latest
}

async function responseJSON<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail ?? 'Could not contact the video service')
  return body
}
export const listVideos = () => fetch('/api/videos').then(responseJSON<VideoManifest[]>).then(videos => {
  // The server lists newest first; keep those most likely to be opened.
  for (const video of [...videos].reverse()) rememberVideo(video)
  return videos
})
export function requestVideo(request: VideoRequest, key: string, files: File[] = []) {
  let body: FormData | string = JSON.stringify(request)
  const headers: Record<string, string> = { 'Idempotency-Key': key }
  if (files.length) {
    body = new FormData()
    body.set('request', JSON.stringify(request))
    files.forEach(file => (body as FormData).append('files', file))
  } else headers['Content-Type'] = 'application/json'
  return fetch('/api/videos', { method: 'POST', headers, body }).then(responseJSON<VideoManifest>).then(rememberVideo)
}
export async function deleteVideo(id: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) await responseJSON(response)
  recentVideos.delete(id)
}

export function videoLesson(video: VideoManifest): Lesson {
  return { id: video.id, videoId: video.id, title: video.title, subtitle: video.provider === 'pi' ? 'Visual explanation' : 'Sample animation', subject: 'My ideas', duration: video.scenes.reduce((sum, scene) => sum + scene.duration, 0), artwork: 'vectors', thumbnail: video.thumbnail, color: 'sage', demo: video.provider === 'simulated', generationStatus: video.status }
}

/** Keep browser-local curriculum context while refreshing server-owned job state. */
export function mergeVideoLessons(videos: VideoManifest[], previous: Lesson[], pendingIds: string[] = []): Lesson[] {
  const saved = new Map(previous.filter(lesson => lesson.videoId).map(lesson => [lesson.videoId, lesson]))
  const refreshed = videos.map(video => {
    const lesson = videoLesson(video), local = saved.get(video.id)
    return local ? { ...lesson, videoMode: local.videoMode, subject: local.subject, subtitle: local.subtitle, color: local.color, artwork: local.artwork, source: local.source, courseLesson: local.courseLesson } : lesson
  })
  // A list request may finish after a newly submitted job has entered the library.
  const ids = new Set(videos.map(video => video.id))
  return [...refreshed, ...previous.filter(lesson => !lesson.videoId || (pendingIds.includes(lesson.videoId) && !ids.has(lesson.videoId)))]
}

export function watchVideo(id: string, onManifest: (manifest: VideoManifest) => void, onConnection: (message: string) => void) {
  const events = new EventSource(`/api/videos/${encodeURIComponent(id)}/events`)
  events.addEventListener('manifest', event => {
    try {
      const manifest = JSON.parse((event as MessageEvent).data) as VideoManifest
      if (manifest.schemaVersion !== 1 || manifest.id !== id || !Array.isArray(manifest.scenes)) throw new Error('Unsupported video response')
      rememberVideo(manifest)
      onConnection(''); onManifest(manifest)
      if (manifest.status === 'complete' || manifest.status === 'failed') events.close()
    } catch { events.close(); onConnection('Could not read this video. Please reload.') }
  })
  events.onerror = () => onConnection('Reconnecting… Available scenes can still play.')
  events.addEventListener('deleted', () => { recentVideos.delete(id); events.close(); onConnection('This video was deleted from the library.') })
  const cached = recentVideos.get(id)
  if (cached) onManifest(cached)
  return () => events.close()
}
