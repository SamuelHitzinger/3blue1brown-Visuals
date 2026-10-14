import { useEffect, useState } from 'react'
import type { LectureVisualization } from '../../../shared/lecture'
import type { ReaderModelCache } from './readerModels'
import LectureVisual from './LectureVisual'

/** Load protected model bytes before handing the unchanged scene to the player. */
export default function ReaderVisual({ visualization, models, suspended }: { visualization: LectureVisualization; models: ReaderModelCache | null; suspended: boolean }) {
  const [resolved, setResolved] = useState<LectureVisualization | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const assetsKey = JSON.stringify(visualization.assets ?? {})
  const hasModels = Object.keys(visualization.assets ?? {}).length > 0
  useEffect(() => {
    if (!models || !hasModels) return
    let active = true
    setError('')
    void models.resolve(visualization).then(next => { if (active) setResolved(next) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'The model could not load.') })
    return () => { active = false }
  }, [models, visualization.id, visualization.source, assetsKey, hasModels, attempt])
  if (!hasModels) return <LectureVisual visualization={visualization} suspended={suspended}/>
  return <>
    {resolved && <LectureVisual visualization={resolved} suspended={suspended}/>}
    {error ? <p className="learning-error" role="alert">{error} <button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Retry model</button></p> : !resolved && <p className="live-reader-notice" role="status">Opening the model for your visualization…</p>}
  </>
}
