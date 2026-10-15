import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LectureVisualization } from '../../../shared/lecture'
import type { LessonPlaybackState } from './lessonPlayback'
import { LessonPlayback } from './lessonPlayback'
import { loadLessonRuntime } from './lessonRuntime'
import { formatTime } from './data'
import { Pause, Play, RotateCcw } from './Icons'

const empty: LessonPlaybackState = { time: 0, duration: 0, playing: false, ended: false, ready: false, error: '' }
const subscribeEmpty = () => () => {}
export default function LectureVisual({ visualization, suspended }: { visualization: LectureVisualization; suspended: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setNearViewport(true); return }
    const observer = new IntersectionObserver(entries => setNearViewport(entries.some(entry => entry.isIntersecting)), { rootMargin: '120px 0px' })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const host = useRef<HTMLDivElement>(null)
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended
  const [playback, setPlayback] = useState<LessonPlayback>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const state = useSyncExternalStore(playback?.subscribe ?? subscribeEmpty, playback?.getState ?? (() => empty))
  useEffect(() => {
    if (!nearViewport) { setPlayback(undefined); return }
    let active = true
    let controller: LessonPlayback | undefined
    const target = host.current
    setPlayback(undefined)
    setError('')
    void loadLessonRuntime().then(async ({ createPlayer, THREE_BLUE_ONE_BROWN_PALETTE }) => {
      if (!active || !target || !visualization.source) return
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-label', visualization.title)
      canvas.setAttribute('role', 'img')
      target.append(canvas)
      const player = createPlayer({ canvas, controlsRoot: target })
      player.setDisplayPalette(THREE_BLUE_ONE_BROWN_PALETTE)
      if (visualization.assets) player.registerAssets(visualization.assets)
      controller = new LessonPlayback(player, false)
      void controller.setSuspended(suspendedRef.current)
      setPlayback(controller)
      await controller.load([{ id: visualization.id, source: visualization.source }])
      if (active && visualization.visualKind === 'interactive') await controller.seek(visualization.duration ?? controller.getState().duration)
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'This visualization could not load.') })
    return () => { active = false; controller?.dispose(); target?.replaceChildren() }
  }, [visualization.id, visualization.source, visualization.visualKind, visualization.duration, attempt, nearViewport])
  useEffect(() => { void playback?.setSuspended(suspended) }, [playback, suspended])
  const failure = error || state.error
  return <div className="lecture-visual" ref={container}>
    <div className="lecture-visual-stage" ref={host}/>{(!nearViewport || suspended) && <div className="lecture-visual-message notebook-visual-idle">{suspended ? 'Visualization paused' : 'Your visual opens as you read'}</div>}
    {failure ? <div className="lecture-visual-message" role="alert"><p>{failure}</p><button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Reload visualization</button></div> : nearViewport && !suspended && !state.ready && <div className="lecture-visual-message" role="status">Opening your visualization…</div>}
    {visualization.visualKind !== 'interactive' && <div className="lecture-visual-controls">
      <button aria-label={state.ended ? 'Replay visualization' : state.playing ? 'Pause visualization' : 'Play visualization'} disabled={!state.ready || !!failure} onClick={() => { void playback?.toggle() }}>{state.ended ? <RotateCcw size={17}/> : state.playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <input type="range" aria-label="Visualization progress" min={0} max={state.duration || 1} step={0.1} value={state.time} disabled={!state.ready || !!failure} onChange={event => { void playback?.seek(Number(event.target.value)) }}/>
      <span>{formatTime(state.time)} / {formatTime(state.duration)}</span>
    </div>}
  </div>
}
