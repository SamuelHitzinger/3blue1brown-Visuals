import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneRequest, SceneRequestInput } from '../../../shared/video/scene-requests'
import type { LessonPlayback } from './lessonPlayback'
import { mergeSceneRequests, requestScenes, watchSceneRequestList } from './sceneRequests'
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
    const stopList = watchSceneRequestList(lessonId, saved => {
      if (version !== lifetime.current) return
      setRequests(current => mergeSceneRequests(current, saved))
    }, message => { if (version === lifetime.current) setConnection(message) })
    const activeWatches = watches.current
    return () => { lifetime.current++; stopList(); activeWatches.forEach(close => close()); activeWatches.clear() }
  }, [lessonId])

  useEffect(() => {
    // Terminal streams close themselves. Drop their handles so a newer restored
    // job discovered on focus can subscribe again.
    for (const [id, close] of watches.current) {
      if (!requests.some(request => request.id === id && !['complete', 'failed'].includes(request.video.status))) {
        close(); watches.current.delete(id)
      }
    }
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
