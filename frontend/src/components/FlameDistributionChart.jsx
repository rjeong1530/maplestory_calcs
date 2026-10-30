import { memo, useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useWorkshopMotion } from '../ui/motion'
import { percentage } from '../data/numberFormat'

const scoreLabel = value => Number(value.toPrecision(5)).toLocaleString()

export default memo(function FlameDistributionChart({ bins, target }) {
  const id = useId()
  const [active, setActive] = useState(null)
  const { entrance, transition } = useWorkshopMotion()
  // Hover/focus changes only the active range, not every formatted range label.
  const labels = useMemo(() => bins?.map((bin, index) => `Score ${scoreLabel(bin.lower)}${bin.lower === bin.upper ? '' : ` to ${scoreLabel(bin.upper)} (${index === bins.length - 1 ? 'inclusive' : 'upper bound excluded'})`}: ${percentage(bin.probability * 100)}%`) ?? [], [bins])
  if (!bins?.length) return <p className="mw-help">Score distribution is unavailable from this server.</p>
  const minimum = bins[0].lower
  const maximum = bins.at(-1).upper
  const span = maximum - minimum || 1
  const peak = Math.max(...bins.map(bin => bin.probability)) || 1
  const x = score => 52 + (score - minimum) / span * 440
  const y = probability => 218 - probability / peak * 170
  const label = (_bin, index) => labels[index]
  return <motion.figure {...entrance} transition={transition} className="flame-distribution" aria-labelledby={id}>
    <h3 id={id}>Probability Distribution</h3>
    <svg viewBox="0 0 520 265" aria-label="Probability per flame score range">
      <text x="52" y="17" className="flame-chart-label">Probability per range</text>
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}>
        <line x1="52" x2="492" y1={y(peak * fraction)} y2={y(peak * fraction)} className="flame-chart-grid" />
        <text x="46" y={y(peak * fraction) + 4} textAnchor="end" className="flame-chart-label">{(peak * fraction * 100).toFixed(1)}%</text>
      </g>)}
      {bins.map((bin, index) => <rect key={index} tabIndex="0" role="img" aria-label={label(bin, index)}
        x={bin.lower === bin.upper ? 245 : x(bin.lower)} y={y(bin.probability)}
        width={bin.lower === bin.upper ? 30 : Math.max(1, x(bin.upper) - x(bin.lower) - 1)} height={Math.max(1, 218 - y(bin.probability))}
        className={`flame-chart-bar${active === index ? ' is-active' : ''}`}
        onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
        <title>{label(bin, index)}</title>
      </rect>)}
      {target >= minimum && target <= maximum && <g className="flame-chart-target">
        <line x1={minimum === maximum ? 260 : x(target)} x2={minimum === maximum ? 260 : x(target)} y1="33" y2="218" />
        <title>Target score: {target}</title>
      </g>}
      {[0, .25, .5, .75, 1].map(fraction => <text key={fraction} x={52 + 440 * fraction} y="237" textAnchor="middle" className="flame-chart-label">{scoreLabel(minimum + (maximum - minimum) * fraction)}</text>)}
      <text x="272" y="260" textAnchor="middle" className="flame-chart-label">Flame score</text>
    </svg>
    <p className="flame-chart-detail" aria-live="polite">{active == null ? `Target: ${scoreLabel(target)}${target < minimum || target > maximum ? ' (outside displayed range)' : ' · dashed purple line'}. Hover or focus a bar for its probability.` : label(bins[active], active)}</p>
    <figcaption className="mw-help">Actual roll probabilities grouped into score ranges. The target probability above uses exact scores.</figcaption>
  </motion.figure>
})
