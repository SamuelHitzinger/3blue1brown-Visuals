import type { VideoManifest } from '../../../shared/video/contract'
import { generationEstimate } from './generationProgressState'
import './generation-progress.css'

export default function GenerationEstimate({ video, subject = 'video' }: { video: VideoManifest; subject?: 'video' | 'scene' }) {
  const { percent, label, scenes } = generationEstimate(video, subject)
  return <div className="generation-completion">
    <div className="generation-completion-heading">
      <span>{label}</span>
      {percent !== undefined && <strong>{video.status === 'complete' ? '100%' : `~${percent}%`}</strong>}
    </div>
    <div className={`generation-completion-track${percent === undefined ? ' is-indeterminate' : ''}`} role="progressbar"
      aria-label={subject === 'scene' ? 'Scene creation progress' : 'Video creation progress'}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      aria-valuetext={`${label}${percent === undefined ? '' : `, ${percent}% estimated`}${scenes ? `, ${scenes}` : ''}`}>
      <span style={percent === undefined ? undefined : { width: `${percent}%` }}/>
    </div>
    <div className="generation-completion-detail"><span>{scenes ?? 'Preparing your explanation'}</span><span>Estimated progress</span></div>
  </div>
}
