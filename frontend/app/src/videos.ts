import type { VideoManifest, VideoRequest } from '../../../shared/video/contract'
import type { Lesson } from './data'

async function responseJSON<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail ?? 'Could not contact the video service')
  return body
}
export const listVideos = () => fetch('/api/videos').then(responseJSON<VideoManifest[]>)
export function requestVideo(request: VideoRequest, key: string, files: File[] = []) {
  let body: FormData | string = JSON.stringify(request)
  const headers: Record<string, string> = { 'Idempotency-Key': key }
  if (files.length) {
    body = new FormData()
    body.set('request', JSON.stringify(request))
    files.forEach(file => (body as FormData).append('files', file))
  } else headers['Content-Type'] = 'application/json'
  return fetch('/api/videos', { method: 'POST', headers, body }).then(responseJSON<VideoManifest>)
}
export async function deleteVideo(id: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) await responseJSON(response)
}
export const archiveVideo = (id: string) => fetch(`/api/videos/${encodeURIComponent(id)}/archive`, { method: 'POST' }).then(responseJSON<VideoManifest>)

export function videoLesson(video: VideoManifest): Lesson {
  return { id: video.id, videoId: video.id, archivedAt: video.archivedAt, title: video.title, subtitle: video.provider === 'pi' ? 'Visual explanation' : 'Sample animation', subject: 'My ideas', duration: video.scenes.reduce((sum, scene) => sum + scene.duration, 0), artwork: 'vectors', thumbnail: video.thumbnail, color: 'sage', demo: video.provider === 'simulated', generationStatus: video.status }
}

/** Keep browser-local curriculum context while refreshing server-owned job state. */
export function mergeVideoLessons(videos: VideoManifest[], previous: Lesson[], pendingIds: string[] = []): Lesson[] {
  const saved = new Map(previous.filter(lesson => lesson.videoId).map(lesson => [lesson.videoId, lesson]))
  const refreshed = videos.map(video => {
    const lesson = videoLesson(video), local = saved.get(video.id)
    // A list request started before archiving may finish after the archive request.
    return local ? { ...lesson, archivedAt: lesson.archivedAt ?? local.archivedAt, videoMode: local.videoMode, subject: local.subject, subtitle: local.subtitle, color: local.color, artwork: local.artwork, source: local.source, courseLesson: local.courseLesson } : lesson
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
      onConnection(''); onManifest(manifest)
      if (manifest.status === 'complete' || manifest.status === 'failed') events.close()
    } catch { events.close(); onConnection('Could not read this video. Please reload.') }
  })
  events.onerror = () => onConnection('Reconnecting… Available scenes can still play.')
  events.addEventListener('deleted', () => { events.close(); onConnection('This video was deleted from the library.') })
  return () => events.close()
}
