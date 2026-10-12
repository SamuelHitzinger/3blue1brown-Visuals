import { Fragment, useState } from 'react'
import type { VideoManifest } from '../../../shared/video/contract'
import GenerationWater from './GenerationWater'
import { illustrativeWaterMl } from './generationWaterEstimate'
import './generation-progress.css'

const number = new Intl.NumberFormat('en-US')

function RollingNumber({ value }: { value: number }) {
  const [frame, setFrame] = useState({ value, previous: value, revision: 0 })
  if (frame.value !== value) {
    setFrame({ value, previous: frame.value, revision: frame.revision + 1 })
  }

  const digits = String(value).split('')
  const previousDigits = String(frame.previous).split('').reverse()
  const direction = value > frame.previous ? 'up' : 'down'

  return <>{digits.map((digit, index) => {
    const place = digits.length - index - 1
    const previous = previousDigits[place]
    const changed = previous !== digit
    const current = <span className="generation-digit-row generation-digit-current">{digit}</span>

    return <Fragment key={place}>
      <span className="generation-digit" data-place={place} data-digit={digit}>
        {changed ? <span key={frame.revision} className={`generation-digit-track generation-digit-${direction}`}>
          {direction === 'down' && current}
          <span className="generation-digit-row">{previous}</span>
          {direction === 'up' && current}
        </span> : current}
      </span>
      {place > 0 && place % 3 === 0 && <span className="generation-separator">,</span>}
    </Fragment>
  })}</>
}

export default function GenerationProgress({ usage, queued = false }: {
  usage?: VideoManifest['tokenUsage']; queued?: boolean
}) {
  const estimated = Boolean(usage && usage.estimatedOutputTokens > 0)
  const total = usage ? usage.totalTokens + usage.estimatedOutputTokens : undefined
  const status = queued ? 'Your video is queued' : 'Generating your video'
  const description = total === undefined ? 'Waiting for token usage' : `${estimated ? 'Approximately ' : ''}${number.format(total)} tokens used`

  return <div className="generation-progress player-status" role="group" aria-label={status}>
    <div className="generation-usage" role="group" aria-live="off" aria-label={description} title={estimated ? 'Estimated while the model is working; reconciled with reported usage after each response' : description}>
      <span className="generation-count" aria-hidden="true" data-value={total}>
        {estimated && <span className="generation-estimate">~</span>}
        {total === undefined ? '—' : <RollingNumber value={total} />}
      </span>
      <span className="generation-unit">tokens</span>
    </div>
    {usage && <GenerationWater milliliters={illustrativeWaterMl(usage)} />}
  </div>
}
