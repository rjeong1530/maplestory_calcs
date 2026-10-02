import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { SLOT_LABELS } from '../data/flameEquipment'
import { buildUpgradeRequest, combineStarforceSteps, orderStarforceSteps, UPGRADE_CATEGORIES, FLAME_WEIGHT_LABELS, POTENTIAL_WEIGHT_LABELS } from '../data/equipmentUpgrade'
import './EquipmentUpgradePlan.css'
import FlameUpgradeOrder from './FlameUpgradeOrder'

const CATEGORIES = UPGRADE_CATEGORIES
const ORDERS = {
  gain_per_meso_first: 'Best gain per meso',
}
const number = value => value == null ? 'Unavailable'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
const signed = value => value == null ? 'Unavailable'
  : `${value > 0 ? '+' : ''}${number(value)}`
const slotName = slot => {
  const [type, index] = slot.split('-')
  return `${SLOT_LABELS[type] || type}${index ? ` ${index}` : ''}`
}

export default function EquipmentUpgradePlan({
  equipment, equipmentClass, classStats, flameWeights, settings, onSettingsChange, onFlameWeightChange,
}) {
  const [selectedCategory, setCategory] = useState('starforce')
  const [flameType, setFlameType] = useState('black')
  const category = settings.categories.includes(selectedCategory) ? selectedCategory : settings.categories[0]
  const [order, setOrder] = useState('gain_per_meso_first')
  const [request, setRequest] = useState(null)
  const controllerRef = useRef(null)
  const payload = buildUpgradeRequest(equipment, classStats, flameWeights, settings)
  const requestKey = JSON.stringify(payload)
  const current = request?.key === requestKey ? request : null
  const busy = current?.status === 'loading'
  const result = current?.result
  const flameRankings = result?.flame_rankings[flameType]
  const rankings = result?.rankings[category]
  const rankedRows = category === 'flames'
    ? [...(rankings?.gain_per_meso_first || [])].sort((a, b) => b.improvement_probability - a.improvement_probability)
    : rankings?.[order] || []
  const groupedRows = category === 'starforce' ? combineStarforceSteps(orderStarforceSteps(rankedRows)) : rankedRows
  const rows = category === 'starforce' ? groupedRows.slice(0, 20) : groupedRows

  useEffect(() => () => controllerRef.current?.abort(), [requestKey])

  async function submit(event) {
    event.preventDefault()
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRequest({ key: requestKey, status: 'loading' })
    try {
      const data = await apiRequest('/api/equipment-upgrade-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestKey,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      })
      if (!controller.signal.aborted) setRequest({ key: requestKey, status: 'done', result: data })
    } catch (error) {
      if (!controller.signal.aborted) setRequest({ key: requestKey, status: 'error', error: error.message })
    }
  }

  return (
    <section className="panel upgrade-plan" aria-labelledby="upgrade-heading">
      <span className="eyebrow">YOUR NEXT UPGRADE</span>
      <h2 id="upgrade-heading">Equipment upgrade order</h2>
      <p className="hint">Compare future Star Force steps and the next roll improvement on each equipped item for {equipmentClass}:
        {' '}{[classStats.main].flat().join(' / ')} primary,
        {' '}{classStats.secondary.length ? `${classStats.secondary.join(' / ')} secondary` : 'no secondary stat'}, {classStats.offense}.
        Record current stars, potential and flames above; unrecorded bonuses count as zero.</p>
      <form onSubmit={submit}>
        <fieldset className="upgrade-categories">
          <legend>Upgrade orders to calculate</legend>
          {Object.entries(CATEGORIES).map(([key, label]) => <label key={key}>
            <input type="checkbox" checked={settings.categories.includes(key)}
              onChange={event => onSettingsChange({ ...settings, categories: event.target.checked
                ? [...settings.categories, key] : settings.categories.filter(value => value !== key) })} />
            {label}
          </label>)}
        </fieldset>
        <div className="upgrade-controls">
          <label>Potential cube
            <select value={settings.cube_type}
              onChange={event => onSettingsChange({ ...settings, cube_type: event.target.value })}>
              <option value="black">Black cube — 22M mesos</option>
              <option value="red">Red cube — 12M mesos</option>
            </select>
          </label>
          <p className="hint">Flame results include Black and Abyssal Flames. Star Force uses each item's enhancement modes.</p>
        </div>
        <fieldset className="upgrade-weights">
          <legend>Potential score weights</legend>
          {Object.entries(POTENTIAL_WEIGHT_LABELS).map(([key, label]) => (
            <label key={key}>{label}
              <input type="number" min="0" step="any" required value={settings[key]}
                onChange={event => onSettingsChange({ ...settings, [key]: event.target.value })} />
            </label>
          ))}
        </fieldset>
        <fieldset className="upgrade-weights">
          <legend>Shared flame and Star Force weights</legend>
          {Object.entries(FLAME_WEIGHT_LABELS)
            .filter(([key]) => key !== 'secondary_stat_per_main' || classStats.secondary.length > 0)
            .map(([key, label]) => (
            <label key={key}>{label}
              <input type="number" min={key === 'secondary_stat_per_main' ? '0.000001' : '0'}
                step="any" required value={flameWeights[key]}
                onChange={event => onFlameWeightChange(key, event.target.value)} />
            </label>
          ))}
        </fieldset>
        <button type="submit" className="primary" disabled={busy || !payload.equipment.length || !settings.categories.length}>
          {busy ? 'Calculating upgrade order…' : 'Calculate upgrade order'}
        </button>
      </form>
      {!settings.categories.length && <p className="hint">Select at least one upgrade order.</p>}
      {!payload.equipment.length && <p className="hint">Equip an item above to compare upgrades.</p>}
      <div aria-live="polite">
        {busy && <p role="status">Calculating expected gains for {payload.equipment.length} items…</p>}
        {request && !current && <p className="hint">Inputs changed. Calculate again to refresh the rankings.</p>}
      </div>
      {current?.error && <p className="error" role="alert">{current.error}</p>}
      {result && <>
        <div className="upgrade-results-controls">
          <div className="calculator-tabs" role="group" aria-label="Upgrade category">
            {Object.entries(CATEGORIES).filter(([key]) => settings.categories.includes(key)).map(([key, label]) => (
              <button type="button" key={key} aria-pressed={category === key}
                onClick={() => setCategory(key)}>{label}</button>
            ))}
          </div>
          {category !== 'flames' && <label>Rank by
            <select value={order} onChange={event => setOrder(event.target.value)}>
              {Object.entries(ORDERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>}
        </div>
        {category !== 'flames' && <p className="hint">Scores are weighted stat points. Gain is measured for each star range or first better roll.
          Efficiency is displayed as flame score gain per 100M mesos.</p>}
        {category === 'starforce' && <p className="hint">
          Showing the top {rows.length} of {groupedRows.length} upgrade ranges in the selected order.{' '}
          Consecutive steps for the same item are combined, with total costs and gains for the range.
          Later ranges require reaching their starting star first; costs and gains exclude those earlier steps.
          Each item's earlier upgrades appear first. Best gain per meso compares ranges of one to six
          additional stars per item. Items below 15 stars also compare targets from 16 to 21 stars to
          account for post-15 gains. Every range uses total gain divided by total expected cost,
          including all prerequisite steps. After choosing a range, it compares again from the new star levels. Consecutive ranges
          for the same item are combined, so a displayed range may exceed six stars.
        </p>}
        {category === 'flames' ? <div className="flame-comparison">
          <div className="calculator-tabs flame-type-toggle" role="group" aria-label="Flame results to display">
            {['black', 'abyssal'].map(type => <button type="button" key={type}
              aria-label={type === 'black' ? 'Black Flames' : 'Abyssal Flames'}
              title={type === 'black' ? 'Black Flames' : 'Abyssal Flames'}
              aria-pressed={flameType === type} onClick={() => setFlameType(type)}>
              <img src={`/images/flames/${type}.png`} alt="" width="32" height="34" />
            </button>)}
          </div>
          <FlameUpgradeOrder
            key={flameType} flameType={flameType} equipment={equipment}
            rows={[...flameRankings.largest_gain_first].sort((a, b) => b.improvement_probability - a.improvement_probability)}
            unavailable={flameRankings.unavailable}
            costPerFlame={result.cost_assumptions_mesos[flameType + '_flame']} />
        </div> : rows.length ? <div className="upgrade-table-scroll" tabIndex="0"
          role="region" aria-label={`${CATEGORIES[category]} upgrade rankings`}>
          <table className="upgrade-table">
            <caption>{CATEGORIES[category]} — {ORDERS[order]}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Equipment</th>
              <th scope="col">{category === 'starforce' ? 'Score before step' : 'Current score'}</th><th scope="col">Expected gain</th>
              <th scope="col">Expected mesos to improve</th><th scope="col">Flame score / 100M mesos</th></tr></thead>
            <tbody>{rows.map((entry, index) => <tr key={`${entry.slot}-${entry.start_star ?? 'roll'}`}>
              <td>{index + 1}</td><th scope="row">{entry.name}
                <small>{slotName(entry.slot)}{entry.next_star != null
                  ? ` · ${entry.start_star ?? entry.current_star_force} → ${entry.next_star} stars` : ''}</small>
                {entry.start_star > entry.current_star_force && <small>
                  Currently {entry.current_star_force}★ · Requires {entry.start_star}★ first
                </small>}
                {entry.note && <small>{entry.note}</small>}
              </th>
              <td>{number(entry.current_score)}</td>
              <td className={entry.expected_score_gain < 0 ? 'upgrade-loss' : ''}>{signed(entry.expected_score_gain)}</td>
              <td>{number(entry.action_cost_mesos)}</td>
              <td>{signed(entry.gain_per_meso == null ? null : entry.gain_per_meso * 100_000_000)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p role="status">No eligible items for this ranking. Check the unavailable estimates below.</p>}
        {category !== 'flames' && rankings.unavailable?.length > 0 && <details className="upgrade-notes">
          <summary>Unavailable {CATEGORIES[category]} estimates ({rankings.unavailable.length})</summary>
          <ul>{rankings.unavailable.map(entry => <li key={entry.slot}>
            <strong>{entry.name}</strong> ({slotName(entry.slot)}
            {entry.next_star != null ? ` · ${entry.start_star} → ${entry.next_star} stars` : ''}): {entry.note}
          </li>)}</ul>
        </details>}
        {result.excluded_superior_equipment.length > 0 && <p className="hint">
          Excluded Superior equipment: {result.excluded_superior_equipment
            .map(entry => `${entry.name} (${slotName(entry.slot)})`).join(', ')}.
        </p>}
      </>}
      <details className="upgrade-notes">
        <summary>How these estimates work</summary>
        <p>Potential assumes Legendary equipment and uses bundled KMS probabilities, without tier-ups.
          Black cubes and black flames keep the better score. Red cubes replace the current potential.
          Star Force uses each item's selected enhancement modes and safeguards, including during boom recovery,
          but excludes replacement costs and events.
          Star Force lists successive one-star upgrades up to the equipment cap or available stat tables.
          Each step's cost covers reaching its target star from its starting star regardless of spare availability.
          Potential and flame costs cover rolling until the score exceeds the recorded score:
          cost per roll divided by the chance of improvement. Their expected gain is the average
          gain among better rolls. Red cube results can be worse while working toward that improvement.</p>
        <p>Unsupported estimates are listed with reasons. HP-based Star Force scoring and some weapon
          Star Force tables are unavailable. Superior Gollux items remain eligible.</p>
      </details>
    </section>
  )
}
