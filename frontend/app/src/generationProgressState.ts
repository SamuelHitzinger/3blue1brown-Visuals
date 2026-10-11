import type { VideoManifest } from '../../../shared/video/contract'

/** Stage-based estimates are separate from playback position and token usage. */
export function generationEstimate(video: VideoManifest, subject: 'video' | 'scene' = 'video') {
  const progress = video.progress
  const total = progress?.totalScenes
  const scenes = total && total > 0
    ? `${progress!.completedScenes} of ${total} scene${total === 1 ? '' : 's'} ready` : undefined
  if (video.status === 'queued') return { percent: 0, label: 'Waiting to start', scenes }
  if (video.status === 'complete') return { percent: 100, label: subject === 'scene' ? 'Scene ready' : 'Video ready', scenes }
  const percent = progress && Number.isFinite(progress.percent) ? Math.max(0, Math.min(99, Math.round(progress.percent))) : undefined
  if (video.status === 'failed') return { percent, label: 'Generation stopped', scenes }
  const scene = subject === 'scene' ? 'your scene'
    : progress?.sceneIndex !== undefined ? `scene ${progress.sceneIndex + 1}${total ? ` of ${total}` : ''}` : 'your scenes'
  const labels = {
    queued: 'Waiting to start', sources: 'Reading your material', script: 'Writing your story',
    narration: video.narrationMode === 'subtitles' ? `Timing ${scene} captions` : `Preparing narration for ${scene}`,
    scene: `Animating ${scene}`, validating: `Checking ${scene}`, finalizing: `Finishing your ${subject}`,
    complete: `Finishing your ${subject}`, failed: 'Generation stopped',
  }
  return { percent, label: progress ? labels[progress.stage] : `Preparing your ${subject}`, scenes }
}
