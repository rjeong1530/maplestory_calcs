import { motion } from 'framer-motion'
import { EquipmentIcon } from './EquipmentGrid'
import { SLOT_LABELS } from '../data/flameEquipment'
import { UPGRADE_CATEGORIES } from '../data/equipmentUpgrade'
import { useWorkshopMotion } from '../ui/motion'

const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const number = value => value == null ? 'Unavailable' : formatter.format(value)
const signed = value => value == null ? 'Unavailable' : `${value > 0 ? '+' : ''}${number(value)}`
const recommendationKey = entry => `${entry.slot}-${entry.start_star ?? 'roll'}`

export default function UpgradeRankTable({ rows, category, equipment, previousRanks = {}, orderLabel = 'Best gain per meso' }) {
  const { reduced, transition, entrance } = useWorkshopMotion()
  return <div className="upgrade-table-region" role="region" aria-label={`${UPGRADE_CATEGORIES[category]} upgrade rankings`} tabIndex="0">
    <table className="upgrade-table workshop-rank-table">
      <caption>{UPGRADE_CATEGORIES[category]} — {orderLabel}</caption>
      <thead><tr>{['Rank', 'Item / details', 'Current → Target', 'Upgrade Type', 'Expected Cost', 'Expected Gain', 'Efficiency'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((entry, index) => {
        const key = recommendationKey(entry)
        const improved = previousRanks[key] != null && index < previousRanks[key]
        const [kind, position] = entry.slot.split('-')
        return <motion.tr key={key} layout={reduced ? false : 'position'} {...entrance}
          initial={reduced ? false : { opacity: 0, y: previousRanks[key] == null ? 6 : Math.max(-48, Math.min(48, (previousRanks[key] - index) * 16)) }}
          transition={transition} className={improved ? 'upgrade-improved' : undefined}>
          <td data-label="Rank">{index + 1}</td>
          <th scope="row" data-label="Item"><div className="upgrade-item-name"><EquipmentIcon item={equipment[entry.slot]} /><span>{entry.name}</span></div>
            <small>{SLOT_LABELS[kind] || kind}{position ? ` ${position}` : ''}</small>
            <details className="upgrade-row-details"><summary>Calculation details</summary>
              <p>{category === 'starforce' ? 'Score before step' : 'Current score'}: {number(entry.current_score)}</p>
              {category === 'starforce' && <p>Expected booms: {number(entry.expected_booms)}</p>}
              {entry.start_star > entry.current_star_force && <p>Currently {entry.current_star_force}★ · Requires {entry.start_star}★ first.</p>}
              {entry.note && <p>{entry.note}</p>}
              {entry.improvement_probability != null && <p>Chance of improvement: {number(entry.improvement_probability * 100)}%</p>}
              <p>Efficiency: weighted score gain per 100M mesos.</p>
            </details>
          </th>
          <td data-label="Current → Target">{category === 'starforce' ? `${entry.start_star ?? entry.current_star_force} → ${entry.next_star} ★` : `${number(entry.current_score)} → Better roll`}</td>
          <td data-label="Upgrade Type"><span className={`upgrade-kind upgrade-kind-${category}`}><span aria-hidden="true">{category === 'starforce' ? '★' : category === 'flames' ? '🔥' : '◇'}</span> {UPGRADE_CATEGORIES[category]}</span></td>
          <td data-label="Expected Cost"><motion.span key={entry.action_cost_mesos} initial={reduced ? false : {opacity:0}} animate={{opacity:1}} transition={transition}>{number(entry.action_cost_mesos)}</motion.span><small>mesos{category === 'potential' ? ' to improve' : ''}</small></td>
          <td data-label="Expected Gain" className={entry.expected_score_gain < 0 ? 'upgrade-loss' : 'upgrade-gain'}><motion.span key={entry.expected_score_gain} initial={reduced ? false : {opacity:0}} animate={{opacity:1}} transition={transition}>{signed(entry.expected_score_gain)}</motion.span></td>
          <td data-label="Efficiency">{signed(entry.gain_per_meso == null ? null : entry.gain_per_meso * 100_000_000)}<small>score / 100M</small></td>
        </motion.tr>
      })}</tbody>
    </table>
  </div>
}
