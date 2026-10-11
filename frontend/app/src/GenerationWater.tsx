import { useId, type CSSProperties } from 'react'
import './generation-water.css'

const glassMilliliters = 250
const maximumGlasses = 12
const volume = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function WaterGlass({ fill, index }: { fill: number; index: number }) {
  const clipId = `generation-water-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const height = 26 * fill
  const waveHeight = Math.min(.65, height / 3)
  const wave = `M -28 0 Q -24.5 ${-waveHeight} -21 0 T -14 0 T -7 0 T 0 0 T 7 0 T 14 0 T 21 0 T 28 0 T 35 0 T 42 0 T 49 0 T 56 0 V 40 H -28 Z`

  return <svg className="generation-water-glass" viewBox="0 0 28 36" aria-hidden="true" focusable="false" data-fill={fill}>
    <defs>
      <clipPath id={clipId}>
        <path d="M5.4 5.7 Q14 6.4 22.5 5.6 L20.3 30.3 Q20.1 32 14 32 Q7.9 32 7.7 30.3 Z" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <g className="generation-water-fill" style={{ transform: `translateY(${32 - height}px)` }}>
        {fill > 0 && <path className="generation-water-wave" d={wave} style={{ animationDelay: `${-(index % 3) * .7}s` }} />}
      </g>
    </g>
    <path className="generation-water-outline" pathLength="1" d="M4.3 4.5 Q13.7 3.4 23.7 4.3 L21.5 30.8 Q21.2 33.3 14.1 33.3 Q6.9 33.1 6.5 31 Z M4.3 4.5 Q14.2 6.1 23.7 4.3" />
  </svg>
}

export default function GenerationWater({ milliliters }: { milliliters: number }) {
  const amount = Number.isFinite(milliliters) ? Math.max(0, milliliters) : 0
  const totalGlasses = Math.ceil(amount / glassMilliliters)
  const shownGlasses = Math.min(maximumGlasses, Math.max(1, totalGlasses))
  const overflow = totalGlasses > maximumGlasses
  const description = `Illustrative water comparison: approximately ${volume.format(amount)} mL, with 250 mL per glass. Based on Le Chat's published 45 mL per 400 output tokens; not measured water use for this model.${overflow ? ` Showing ${maximumGlasses} glasses; + represents additional water.` : ''}`

  // One row up to six glasses, otherwise two balanced rows (7 → 4 + 3, 12 → 6 + 6), never a stray remainder.
  const columns = shownGlasses <= 6 ? shownGlasses : Math.ceil(shownGlasses / 2)

  return <div className="generation-water" role="img" aria-label={description} title={description} data-milliliters={amount}
    style={{ '--generation-water-columns': columns } as CSSProperties}>
    <span className="generation-water-approximately" aria-hidden="true">≈</span>
    <span className="generation-water-glasses" aria-hidden="true">
      {Array.from({ length: shownGlasses }, (_, index) => <WaterGlass key={index} index={index} fill={Math.min(1, Math.max(0, amount / glassMilliliters - index))} />)}
    </span>
    <span className="generation-water-overflow" aria-hidden="true">{overflow ? '+' : ''}</span>
  </div>
}
