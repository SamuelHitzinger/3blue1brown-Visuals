import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneRequest, SceneRequestInput } from '../../../shared/video/scene-requests'
import type { LessonPlayback } from './lessonPlayback'
import { listSceneRequests, requestScenes } from './sceneRequests'
import { watchVideo } from './videos'

export function useSceneRequests(lessonId: string, playback: LessonPlayback | undefined, ready: boolean) {
  const [requests, setRequests] = useState<SceneRequest[]>([])
  const [connection, setConnection] = useState('')
  const watches = useRef(new Map<string, () => void>())
  const lifetime = useRef(0)
  const attempts = useRef(new Map<string, string>())
  useEffect(() => {
    const version = ++lifetime.current
    setRequests([]); setConnection('')
    void listSceneRequests(lessonId).then(saved => {
      if (version !== lifetime.current) return
      setRequests(current => [...saved.map(request => current.find(r => r.id === request.id) ?? request), ...current.filter(r => !saved.some(s => s.id === r.id))])
    }).catch(() => { if (version === lifetime.current) setConnection('Could not load added scenes. Reload to try again.') })
    const activeWatches = watches.current
    return () => { lifetime.current++; activeWatches.forEach(close => close()); activeWatches.clear() }
  }, [lessonId])

  useEffect(() => {
    for (const request of requests) {
      if (watches.current.has(request.id) || ['complete', 'failed'].includes(request.video.status)) continue
      const version = lifetime.current
      const close = watchVideo(request.id, video => {
        if (version !== lifetime.current) return
        setRequests(current => current.map(r => r.id === request.id && video.revision > r.video.revision ? { ...r, video } : r))
      }, message => { if (version === lifetime.current) setConnection(message) })
      watches.current.set(request.id, close)
    }
  }, [requests])

  useEffect(() => { if (ready) void playback?.acceptSceneRequests(requests) }, [requests, playback, ready])

  const submit = useCallback(async (input: SceneRequestInput) => {
    const version = lifetime.current
    const serialized = JSON.stringify(input)
    const key = attempts.current.get(serialized) ?? crypto.randomUUID()
    attempts.current.set(serialized, key)
    const result = await requestScenes(input, key)
    if (version !== lifetime.current) return
    setRequests(current => current.some(r => r.id === result.id) ? current : [...current, result])
    setConnection('')
    attempts.current.delete(serialized)
  }, [])
  return { requests, connection, submit }
}
