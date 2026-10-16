import { useEffect, useRef, useState } from 'react'
import { acceptLiveAnimation, LiveAnimationHttpError, LiveAnimationLoop, LiveAnimationTiming, markLiveAnimationRendered, readLiveAnimationReply } from './liveLectureAnimation'
import type { LiveAnimationReply } from './liveLectureAnimation'
import './live-lecture-canvas.css'

type Runtime = typeof import('animlib/live')
type Resources = { runtime: Runtime; world: InstanceType<Runtime['LiveWorld']>; renderer: InstanceType<Runtime['CanvasRenderer']>; journal: InstanceType<Runtime['CommittedContextJournal']> }

export default function LiveLectureCanvas({ lectureId, suspended, sourceRevision, finished }: {
  lectureId: string; suspended: boolean; sourceRevision: number; finished: boolean
}) {
  const host = useRef<HTMLDivElement>(null), loop = useRef<LiveAnimationLoop | undefined>(undefined)
  const blocked = useRef({ suspended, finished }); blocked.current = { suspended, finished }
  const [state, setState] = useState({ active: false, message: 'Start to visualize new lecture content as it arrives.', error: '' })
  const [hasScene, setHasScene] = useState(false)

  useEffect(() => {
    const target = host.current
    if (!target) return
    let alive = true, resources: Resources | undefined, initializing: Promise<Resources> | undefined, animationFrame = 0, rendering = false, renderFailed = false
    const runId = `lecture-${crypto.randomUUID()}`
    const timing = new URLSearchParams(location.search).get('liveTiming') === '1'
      ? new LiveAnimationTiming(event => console.info('LIVE_ANIMATION_TIMING ' + JSON.stringify({ lectureId, runId, ...event }))) : undefined
    setHasScene(false); setState({ active: false, message: 'Start to visualize new lecture content as it arrives.', error: '' })
    const available = () => {
      if (!alive || blocked.current.suspended || blocked.current.finished || document.hidden) throw Error('Live animation updates are paused.')
    }
    const fail = (reason: unknown) => {
      if (!alive) return
      const message = reason instanceof Error ? reason.message : 'The live animation could not render.'
      renderFailed = true; controller.stop(message); setState({ active: false, message, error: message })
    }
    const ensureResources = async (): Promise<Resources> => {
      if (resources && !initializing) return resources
      if (initializing) return initializing
      initializing = (async () => {
        const runtime = await import('animlib/live')
        available()
        const canvas = document.createElement('canvas')
        canvas.setAttribute('aria-label', 'Live lecture animation'); canvas.setAttribute('role', 'img'); target.append(canvas)
        let renderer: Resources['renderer']
        const world = new runtime.LiveWorld({ clock: () => performance.now() / 1000,
          prepare: async (scene, assets, signal) => { signal.throwIfAborted(); await renderer.prepare([scene], assets); signal.throwIfAborted() } })
        renderer = new runtime.CanvasRenderer(canvas, undefined, world.assetGeometry)
        resources = { runtime, world, renderer, journal: new runtime.CommittedContextJournal() }
        renderer.onError = fail
        try { await renderer.prepare([], world.assetGeometry) }
        catch (error) { world.dispose(); renderer.dispose(); resources = undefined; target.replaceChildren(); throw error }
        if (!alive) { world.dispose(); renderer.dispose(); throw Error('Live animation closed.') }
        return resources
      })().finally(() => { initializing = undefined })
      return initializing
    }
    const controller = new LiveAnimationLoop({
      request: async (sourceCursor, signal) => {
        available(); signal.throwIfAborted()
        const current = await ensureResources()
        available(); signal.throwIfAborted(); renderFailed = false
        const revision = current.world.revision, sampledAt = performance.now() / 1000, frame = await current.world.sample(sampledAt)
        available(); signal.throwIfAborted()
        if (current.world.revision !== revision) throw Error('The animation changed while preparing its update.')
        const world = current.runtime.buildWorldContext({ summary: current.world.summary(), sampledRevision: revision, sampledAt,
          frame, journal: current.journal, requestOverheadBytes: 80000 })
        if (alive) setState({ active: true, message: 'Following the latest lecture content…', error: '' })
        const requestId = timing?.requested(sourceCursor, revision)
        const response = await fetch(`/api/lectures/${encodeURIComponent(lectureId)}/animation`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
          body: JSON.stringify({ sourceCursor, baseRevision: revision, world }) })
        let result: unknown
        try { result = await response.json() } catch {
          if (response.status === 504) throw new LiveAnimationHttpError(504, 'Animation request timed out.')
          throw Error('The live animation service could not respond. Try again.')
        }
        if (!response.ok) throw new LiveAnimationHttpError(response.status, typeof (result as { detail?: unknown })?.detail === 'string' ? (result as { detail: string }).detail : 'The live animation could not update. Try again.')
        const reply = readLiveAnimationReply(result, sourceCursor)
        if (reply.baseRevision !== revision) throw Error('The animation response does not match the requested scene.')
        if (requestId !== undefined) timing?.responded(requestId, reply)
        return reply
      },
      accept: async (reply: LiveAnimationReply, signal, guard) => {
        const current = resources
        if (!current) throw Error('The live animation is not ready.')
        const beforeCommit = () => { available(); guard() }
        const previousRevision = current.world.revision
        const message = await acceptLiveAnimation(current.runtime, current.world, current.journal, runId, reply, signal, beforeCommit)
        timing?.committed(reply, previousRevision, current.world.revision)
        if (alive && current.world.revision > 0) setHasScene(true)
        return message
      },
      status: (active, message, failed) => { if (alive) setState({ active, message, error: failed ? message : '' }) },
    })
    loop.current = controller
    const draw = async () => {
      if (!alive) return
      const current = resources
      if (current && !initializing && !rendering && !renderFailed && !blocked.current.suspended && !document.hidden) {
        rendering = true
        try {
          const revision = current.world.revision, frame = await current.world.sample(performance.now() / 1000)
          if (alive && !blocked.current.suspended && revision === current.world.revision) {
            if (!current.renderer.render(frame, current.world.rendererOptions)) throw Error('The live animation renderer could not submit a frame.')
            markLiveAnimationRendered(current.journal, revision)
            const nextFrame = timing?.rendered(revision, current.renderer.backend)
            if (nextFrame) requestAnimationFrame(() => { if (alive && !document.hidden) nextFrame() })
          }
        } catch (error) { fail(error) } finally { rendering = false }
      }
      if (alive) animationFrame = requestAnimationFrame(() => { void draw() })
    }
    animationFrame = requestAnimationFrame(() => { void draw() })
    const hidden = () => { if (document.hidden) controller.stop('Updates paused while this page is hidden.') }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      alive = false; controller.dispose(); cancelAnimationFrame(animationFrame); document.removeEventListener('visibilitychange', hidden)
      resources?.world.dispose(); resources?.renderer.dispose(); target.replaceChildren()
      if (loop.current === controller) loop.current = undefined
    }
  }, [lectureId])

  useEffect(() => {
    if (suspended || finished) loop.current?.stop(finished ? 'Lecture finished. Your animation remains available.' : 'Live animation updates paused.')
  }, [suspended, finished])
  useEffect(() => { loop.current?.wake() }, [sourceRevision])

  return <section className="live-lecture-panel" aria-labelledby="live-lecture-heading">
    <div className="live-lecture-heading"><h2 id="live-lecture-heading">Live animation</h2>
      <button className="secondary-button" disabled={suspended || finished} onClick={() => { if (loop.current?.active) loop.current.stop(); else loop.current?.start() }}>
        {state.active ? 'Stop updates' : state.error ? 'Retry live animation' : hasScene ? 'Resume updates' : 'Start live animation'}
      </button>
    </div>
    <p className="live-lecture-status" role={state.error ? 'alert' : 'status'}>{state.message}</p>
    <div className={`live-lecture-stage${hasScene ? ' has-scene' : ''}`} ref={host}/>
    {!hasScene && <p className="live-lecture-hint">Objects can appear before every detail is known. New facts update the same scene.</p>}
  </section>
}
