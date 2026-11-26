import { memo, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { count } from '../data/numberFormat'

// Plot the backend's sampled CDF as steps. No interpolation, fitted curve,
// independent-roll formula, or new probability computation is introduced.
export default memo(function StarForceProbabilityChart({ distribution }) {
  const id = useId()
  const reduced = useReducedMotion()
  const values = distribution?.probabilities
  if (!values?.length || !(distribution.step_mesos > 0)) return null
  const last = values.length - 1
  const width = 320
  const height = 160
  const path = values.map((value, i) => i === 0
    ? `M0,${height * (1 - value)}`
    : `H${last ? i / last * width : 0}V${height * (1 - value)}`).join(' ')
  const sampledMax = last * distribution.step_mesos
  const budgetLabel = value => value >= 1e9 ? `${(value / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`
    : value >= 1e6 ? `${(value / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : count(value)
  return <motion.figure className="sf-chart" initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .25 }}>
    <figcaption id={`${id}-title`}>Cumulative success probability</figcaption>
    <svg viewBox="0 0 380 215" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <desc id={`${id}-description`}>Chance of reaching the target within a meso budget, using the returned probability samples. Sampled budgets range from 0 to {count(sampledMax)} mesos. Final sampled chance: {(values.at(-1) * 100).toFixed(3)} percent.</desc>
      <g transform="translate(42 12)">
        {[0, .25, .5, .75, 1].map(value => <g key={value}>
          <line x1="0" x2={width} y1={height * (1 - value)} y2={height * (1 - value)} stroke="var(--border)" strokeDasharray="3 3" />
          <text x="-7" y={height * (1 - value) + 3} textAnchor="end">{value * 100}%</text>
        </g>)}
        <path d={path} fill="none" stroke="var(--purple)" strokeWidth="2" />
        {[0, .5, 1].map(fraction => <text key={fraction} x={fraction * width} y={height + 18} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{budgetLabel(sampledMax * fraction)}</text>)}
        <text x={width / 2} y={height + 37} textAnchor="middle">Meso budget</text>
      </g>
    </svg>
    <p className="mw-help">Sampled estimates, including boom recovery. Use the budget controls below for exact grid lookups.</p>
  </motion.figure>
})
