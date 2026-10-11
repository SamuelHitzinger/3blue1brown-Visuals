import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, ClosedCaptions, Maximize, MenuGlyph, Pause, Play, RotateCcw } from './Icons'
import type { Lesson } from './data'
import { formatTime } from './data'
import { LessonPlayback } from './lessonPlayback'
import type { LessonPlaybackState } from './lessonPlayback'
import { lessonScenes } from './lessonScenes'
import { useSceneRequests } from './useSceneRequests'
import { insertedSceneId } from '../../../shared/video/scene-requests'
import { watchVideo } from './videos'
import type { Player } from 'animlib'
import CanvasQuestion, { useCanvasQuestion } from './CanvasQuestion'
import type { VideoManifest } from '../../../shared/video/contract'
import GenerationProgress from './GenerationProgress'
import { captionAt } from './captions'

const loadingState: LessonPlaybackState = { time: 0, duration: 0, playing: false, ended: false, ready: false, error: '' }
const getLoadingState = () => loadingState
const subscribeLoading = () => () => {}
export default function LessonPlayer({ lesson, menuOpen, onMenu, menuContent, onHome, onPlayed, overlayOpen }: {
  lesson: Lesson; menuOpen: boolean; onMenu: () => void
  menuContent: ReactNode; onHome: () => void; onPlayed: (id: string) => void; overlayOpen: boolean
}) {
  const canvasHost = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const renderer = useRef<Player | undefined>(undefined)
  const latestLesson = useRef(lesson)
  latestLesson.current = lesson
  const suspended = useRef(menuOpen || overlayOpen)
  const [playback, setPlayback] = useState<LessonPlayback>()
  const [startupError, setStartupError] = useState('')
  const [connection, setConnection] = useState('')
  const [manifest, setManifest] = useState<VideoManifest>()
  const [attempt, setAttempt] = useState(0)
  const [isFullscreen, setFullscreen] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  useEffect(() => { setCaptionsEnabled(manifest?.narrationMode === 'subtitles') }, [manifest?.id, manifest?.narrationMode])
  const [cursorHidden, setCursorHidden] = useState(false)
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const state = useSyncExternalStore(playback?.subscribe ?? subscribeLoading, playback?.getState ?? getLoadingState)
  const { draft, openQuestion, closeQuestion, changeQuestion } = useCanvasQuestion({
    lesson, time: state.time, disabled: menuOpen || overlayOpen || !state.ready || Boolean(startupError || state.error),
    getScene: () => {
      const player = renderer.current
      if (!player) return undefined
      player.pause()
      const current = player.getState()
      const snapshot = player.getInteractionSnapshot()
      return { id: current.scene, time: current.time, frame: snapshot?.frame, camera: snapshot?.camera, controls: current.controls }
    },
  })
  const { requests, connection: requestConnection, submit: submitRequest } = useSceneRequests(lesson.videoId ?? lesson.id, playback, state.ready)
  const latestRequest = requests.at(-1)
  const pendingRequests = requests.filter(request => request.video.status === 'queued' || request.video.status === 'generating').length
  const submitQuestion = async () => {
    if (!draft) return
    const local = !lesson.videoId ? lessonScenes(lesson, { background: 'BLACK', ink: 'WHITE', accent: 'BLUE' }).find(scene => scene.id === draft.context.scene?.id) : undefined
    await submitRequest({ question: draft.question, context: { ...draft.context, lessonId: lesson.videoId ?? lesson.id },
      ...(local ? { localScene: { ...local, duration: lesson.duration } } : {}) })
    closeQuestion(draft.id)
  }
  const recorded = useRef(false)
  useEffect(() => {
    if (!recorded.current && state.ready && state.playing && state.time > 0 && !startupError && !state.error) {
      recorded.current = true
      onPlayed(lesson.id)
    }
  }, [state.ready, state.playing, state.time, state.error, startupError, lesson.id, onPlayed])
  const questionOpen = Boolean(draft)
  suspended.current = menuOpen || overlayOpen || questionOpen
  const error = startupError || state.error
  const generating = manifest?.status === 'queued' || manifest?.status === 'generating'
  const duration = state.duration || lesson.duration
  const progress = duration ? Math.min(1, state.time / duration) : 0
  const enabled = state.ready && !error && !menuOpen && !overlayOpen && !questionOpen
  // Scene/audio handoffs briefly pause the renderer without pausing the lesson.
  const playbackRequested = Boolean(state.wantsPlay) && !state.ended && !error
  const autoHideControls = enabled && playbackRequested && !state.buffering
  const revealCursor = useCallback(() => {
    clearTimeout(cursorTimer.current)
    setCursorHidden(false)
    if (autoHideControls) {
      cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000)
    }
  }, [autoHideControls])

  useEffect(() => {
    revealCursor()
    return () => clearTimeout(cursorTimer.current)
  }, [revealCursor])

  useEffect(() => {
    // Library refreshes replace lesson metadata, including on window focus.
    // Key playback to lesson/video identity, not the metadata object's reference.
    const lesson = latestLesson.current
    let active = true
    let controller: LessonPlayback | undefined
    const host = canvasHost.current
    let disconnect: (() => void) | undefined
    setPlayback(undefined)
    setStartupError('')
    setConnection('')
    setManifest(undefined)
    // Load the renderer only when opening a lesson, keeping the workspace light.
    let rendererPromise: Promise<LessonPlayback | undefined> | undefined
    const loadRenderer = () => rendererPromise ??= import('animlib').then(({ createPlayer, THREE_BLUE_ONE_BROWN_PALETTE }) => {
      if (!active || !host || !screen.current) return
      // Own the canvas imperatively: renderer recovery can replace a context-locked surface.
      const canvas = document.createElement('canvas')
      canvas.className = 'lesson-canvas'
      canvas.setAttribute('aria-label', `Animated preview: ${lesson.title}`)
      canvas.setAttribute('role', 'img')
      host.append(canvas)
      const player = createPlayer({ canvas, controlsRoot: host.parentElement! })
      renderer.current = player
      // Keep the lesson canvas black regardless of the surrounding app theme.
      player.setDisplayPalette(THREE_BLUE_ONE_BROWN_PALETTE)
      controller = new LessonPlayback(player, !lesson.videoId)
      void controller.setSuspended(suspended.current)
      setPlayback(controller)
      return controller
    })
    const failed = (error: unknown) => {
      if (active) setStartupError(error instanceof Error ? error.message : String(error))
    }
    if (lesson.videoId) {
      disconnect = watchVideo(lesson.videoId, next => {
        if (!active) return
        setManifest(previous => previous && previous.revision >= next.revision ? previous : next)
        // Usage should remain visible even before a playable canvas exists.
        if (next.scenes.length) void loadRenderer().then(current => { if (active) return current?.acceptManifest(next) }).catch(failed)
      }, message => { if (active) setConnection(message) })
    } else {
      void Promise.all([loadRenderer(), import('animlib')]).then(([current, { Color }]) => {
        if (!active || !current) return
        return current.load(lessonScenes(lesson, {
          background: Color.BLACK,
          ink: Color.WHITE,
          accent: Color.BLUE,
        }), lesson.duration * (lesson.progress ?? 0))
      }).catch(failed)
    }
    return () => { active = false; disconnect?.(); renderer.current = undefined; controller?.dispose(); host?.replaceChildren() }
  }, [lesson.id, lesson.videoId, attempt])

  useEffect(() => { void playback?.setSuspended(menuOpen || overlayOpen || questionOpen) }, [playback, menuOpen, overlayOpen, questionOpen])
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === screen.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (menuOpen || overlayOpen || questionOpen || (event.target as HTMLElement).closest('input,select,textarea,button,[contenteditable="true"]')) return
      if (event.key === 'Escape') { onHome(); return }
      if (!enabled || !playback) return
      if (event.code === 'Space') { event.preventDefault(); void playback.toggle() }
      if (event.key === 'ArrowRight') { event.preventDefault(); void playback.seek(playback.getState().time + 10) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); void playback.seek(playback.getState().time - 10) }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [enabled, playback, onHome, menuOpen, overlayOpen, questionOpen])

  const fullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen?.() : screen.current?.requestFullscreen?.()
    void action?.catch(() => {})
  }

  const captionScene = manifest?.scenes.find(scene => scene.id === state.sceneId)
    ?? requests.flatMap(request => request.video.scenes.map(scene => ({ ...scene, id: insertedSceneId(request.id, scene.id) }))).find(scene => scene.id === state.sceneId)
  const caption = captionsEnabled && captionScene ? captionAt([captionScene], state.sceneTime ?? 0) : ''
  return <div className={`player-page ${captionsEnabled ? 'has-captions' : ''} ${state.playing ? 'is-playing' : ''} ${cursorHidden && autoHideControls ? 'is-player-idle' : ''}`} ref={screen} tabIndex={-1} onContextMenu={openQuestion} onPointerMove={revealCursor} onPointerDown={revealCursor} onKeyDown={revealCursor} onFocusCapture={revealCursor}>
    <div className="player-menu-anchor"><button className={`icon-button player-menu-toggle ${menuOpen ? 'is-open' : ''}`} aria-label="Open video menu" aria-expanded={menuOpen} aria-controls="navigation-drawer" onClick={onMenu}><MenuGlyph/></button>{menuContent}</div>
    {(connection || (state.ready && state.generationError)) && <p className="player-notice" role="status">{state.generationError || connection}</p>}
    <div className="player-stage">
      <div ref={canvasHost} className="lesson-canvas-host"/>
      {captionsEnabled && <div className="lesson-subtitles" aria-label="Subtitles">{caption}</div>}
      {generating && !state.ready && !error && <GenerationProgress usage={manifest.tokenUsage} queued={manifest.status === 'queued'}/>}
      {!generating && !state.ready && !error && <p className="player-status" role="status">{manifest?.error || state.generationError || 'Loading your lesson…'}</p>}
      {state.ready && state.buffering && <p className="player-status" role="status">{state.waitingForInsertion ? 'Waiting for your requested scenes…' : 'Preparing the next scene…'}</p>}
      {error && <div className="player-status player-error" role="alert"><strong>This lesson couldn’t play.</strong><p>{error}</p><button className="secondary-button" onClick={() => setAttempt(old => old + 1)}>Try again</button></div>}
    </div>
    {draft && <CanvasQuestion key={draft.id} draft={draft} screen={screen} onChange={changeQuestion} onClose={closeQuestion} onSubmit={submitQuestion}/>}
    {(latestRequest || requestConnection || state.insertionError) && <div className="scene-request-status" role="status">
      <span>{state.insertionError ? 'The added scenes could not play. Your lesson is still available.' : requestConnection || (pendingRequests ? `Creating your follow-up scenes${pendingRequests > 1 ? ` (${pendingRequests} requests)` : ''}… Playback will wait at the insertion point.`
        : latestRequest?.video.status === 'failed' ? 'Could not finish the added scenes. Right-click to try a new request.'
        : `${latestRequest?.video.scenes.length ?? 0} scene${latestRequest?.video.scenes.length === 1 ? '' : 's'} added after your selected scene.`)}</span>
      {!!latestRequest?.video.scenes.length && !state.insertionError && <button disabled={!state.ready || !playback?.hasScene(insertedSceneId(latestRequest.id, latestRequest.video.scenes[0].id))} onClick={() => { closeQuestion(); void playback?.playScene(insertedSceneId(latestRequest.id, latestRequest.video.scenes[0].id)) }}>Play added scenes <ArrowRight size={14}/></button>}
    </div>}
    <div className="player-controls">
      <div className="player-control-row">
        <button className="icon-button" disabled={!enabled} aria-label={state.ended ? 'Replay lesson' : playbackRequested ? 'Pause lesson' : 'Play lesson'} onClick={() => { void playback?.toggle() }}>{state.ended ? <RotateCcw size={19}/> : playbackRequested ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button>
        <div className="player-timeline">
          <div className="progress-wrap"><div className="progress-track"><span className="progress-fill" style={{ width: `${progress * 100}%` }}/><span className="progress-thumb" style={{ left: `${progress * 100}%` }}/></div><input type="range" min="0" max={duration} step="0.1" value={state.time} disabled={!enabled} onChange={event => { void playback?.seek(Number(event.target.value)) }} aria-label="Video progress" aria-valuetext={`${formatTime(state.time)} of ${formatTime(duration)}`}/></div>
          <div className="progress-meta"><span>{formatTime(state.time)}</span><span>{state.playing ? 'A little more understanding, every second.' : state.ended ? 'That’s an aha! moment.' : 'Take your time. Curiosity can wait.'}</span><span>{formatTime(duration)}</span></div>
        </div>
        <button className="icon-button" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={fullscreen}><Maximize size={17}/></button>
        <button className="icon-button captions-toggle" aria-label="Captions" aria-pressed={captionsEnabled} title={captionsEnabled ? 'Turn captions off' : 'Turn captions on'} onClick={() => setCaptionsEnabled(enabled => !enabled)}><ClosedCaptions size={19}/></button>
      </div>
    </div>
    {state.ended && <div className="lesson-complete"><button onClick={onHome}>Back to your library <ArrowRight size={16}/></button></div>}
    {enabled && !playbackRequested && !state.ended && !state.buffering && <button className="paused-indicator" onClick={() => { void playback?.toggle() }} aria-label="Resume lesson"><Play size={24} fill="currentColor"/></button>}
  </div>
}
