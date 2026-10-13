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
  const host = useRef<HTMLDivElement>(null)
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended
  const [playback, setPlayback] = useState<LessonPlayback>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const state = useSyncExternalStore(playback?.subscribe ?? subscribeEmpty, playback?.getState ?? (() => empty))
  useEffect(() => {
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
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'This visualization could not load.') })
    return () => { active = false; controller?.dispose(); target?.replaceChildren() }
  }, [visualization.id, visualization.source, attempt])
  useEffect(() => { void playback?.setSuspended(suspended) }, [playback, suspended])
  const failure = error || state.error
  return <div className="lecture-visual">
    <div className="lecture-visual-stage" ref={host}/>
    {failure ? <div className="lecture-visual-message" role="alert"><p>{failure}</p><button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Reload visualization</button></div> : !state.ready && <div className="lecture-visual-message" role="status">Opening your visualization…</div>}
    <div className="lecture-visual-controls">
      <button aria-label={state.ended ? 'Replay visualization' : state.playing ? 'Pause visualization' : 'Play visualization'} disabled={!state.ready || !!failure} onClick={() => { void playback?.toggle() }}>{state.ended ? <RotateCcw size={17}/> : state.playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <input type="range" aria-label="Visualization progress" min={0} max={state.duration || 1} step={0.1} value={state.time} disabled={!state.ready || !!failure} onChange={event => { void playback?.seek(Number(event.target.value)) }}/>
      <span>{formatTime(state.time)} / {formatTime(state.duration)}</span>
    </div>
  </div>
}
