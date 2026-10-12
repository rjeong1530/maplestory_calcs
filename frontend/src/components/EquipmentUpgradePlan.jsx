import LoadingStatus from './LoadingStatus'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { SLOT_LABELS } from '../data/flameEquipment'
import { buildUpgradeRequest, combineStarforceSteps, orderStarforceSteps, UPGRADE_CATEGORIES, MVP_RANKS, FLAME_WEIGHT_LABELS, POTENTIAL_WEIGHT_LABELS } from '../data/equipmentUpgrade'
import './EquipmentUpgradePlan.css'
import { cubeCostLabel } from '../data/cubeCosts'
import FlameUpgradeOrder from './FlameUpgradeOrder'
import OverallUpgradeOrder from './OverallUpgradeOrder'

const CATEGORIES = UPGRADE_CATEGORIES
const scoreFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const number = value => value == null ? 'Unavailable'
  : scoreFormat.format(value)
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
  const category = selectedCategory === 'overall' || settings.categories.includes(selectedCategory)
    ? selectedCategory : settings.categories[0]
  const [request, setRequest] = useState(null)
  const controllerRef = useRef(null)
  const payload = useMemo(() => buildUpgradeRequest(equipment, classStats, flameWeights, settings),
    [equipment, classStats, flameWeights, settings])
  const requestKey = useMemo(() => JSON.stringify(payload), [payload])
  const current = request?.key === requestKey ? request : null
  const busy = current?.status === 'loading'
  const result = current?.result
  const flameRankings = result?.flame_rankings[flameType]
  const rankings = result?.rankings[category]
  const groupedRows = useMemo(() => {
    const rankedRows = rankings?.gain_per_meso_first ?? []
    return category === 'starforce' ? combineStarforceSteps(orderStarforceSteps(rankedRows)) : rankedRows
  }, [category, rankings])
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
        signal: controller.signal,
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
        <p><strong>Overall upgrade mode: {payload.laddering_enabled ? 'Laddering' : 'Standard'}</strong></p>
        <p className="hint">Each item's laddering checkbox enforces its starting threshold in the Overall tab.
          Items without laddering settings use standard upgrades. Record second-copy stats in Current equipment stats; minimum scores are calculated automatically.</p>
        <fieldset className="upgrade-categories">
          <legend>Upgrade orders to calculate</legend>
          {Object.entries(CATEGORIES).map(([key, label]) => <label key={key}>
            <input type="checkbox" checked={settings.categories.includes(key)}
              onChange={event => onSettingsChange({ ...settings, categories: event.target.checked
                ? [...settings.categories, key] : settings.categories.filter(value => value !== key) })} />
            {label}
          </label>)}
        </fieldset>
        <label className="starforce-safeguard-control">
          <input type="checkbox" checked={settings.shining_starforce_sunday}
            onChange={event => onSettingsChange({ ...settings, shining_starforce_sunday: event.target.checked })} />
          <span>Shining Star Force Sunday</span>
        </label>
        <label>MVP rank
          <select value={settings.mvp_rank}
            onChange={event => onSettingsChange({ ...settings, mvp_rank: event.target.value })}>
            {Object.entries(MVP_RANKS).map(([rank, label]) => (
              <option value={rank} key={rank}>{label}</option>
            ))}
          </select>
        </label>
        <label className="cube-sale-control">
          <input type="checkbox" checked={settings.cube_sale}
            onChange={event => onSettingsChange({ ...settings, cube_sale: event.target.checked })} />
          <span>Cube sale (25% off black and red cubes)</span>
        </label>
        <div className="upgrade-controls">
          <label>Potential cube
            <select value={settings.cube_type}
              onChange={event => onSettingsChange({ ...settings, cube_type: event.target.value })}>
              <option value="black">Black cube</option>
              <option value="red">Red cube</option>
            </select>
            <span className="cube-price" aria-live="polite">{cubeCostLabel(settings.cube_type, settings.cube_sale)}</span>
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
            .filter(([key]) => key !== 'secondary_stat_value' || classStats.secondary.length > 0)
            .map(([key, label]) => (
            <label key={key}>{label}
              <input type="number" min="0"
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
        {busy && <LoadingStatus>Calculating expected gains for {payload.equipment.length} items…</LoadingStatus>}
        {request && !current && <p className="hint">Inputs changed. Calculate again to refresh the rankings.</p>}
      </div>
      {current?.error && <p className="error" role="alert">{current.error}</p>}
      {result && <>
        <div className="upgrade-results-controls">
          <div className="upgrade-category-tabs" role="group" aria-label="Upgrade category">
            {Object.entries(CATEGORIES).filter(([key]) => settings.categories.includes(key)).map(([key, label]) => (
              <button type="button" key={key} aria-pressed={category === key}
                onClick={() => setCategory(key)}>{label}</button>
            ))}
            <button type="button" aria-pressed={category === 'overall'}
              onClick={() => setCategory('overall')}>Overall</button>
          </div>
        </div>

        {category !== 'flames' && category !== 'overall' && <p className="hint">Scores are weighted stat points. Gain is measured for each star range or first better roll.
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
        {category === 'overall' ? <OverallUpgradeOrder plan={result.overall_upgrade_order}
          settings={settings} cubeType={settings.cube_type} />
          : category === 'flames' ? <div className="flame-comparison">
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
            <caption>{CATEGORIES[category]} — Best gain per meso</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Equipment</th>
              <th scope="col">{category === 'starforce' ? 'Score before step' : 'Current score'}</th><th scope="col">Expected gain</th>
              {category === 'starforce' && <th scope="col">Expected booms</th>}
              <th scope="col">{category === 'starforce' ? 'Expected total mesos' : 'Expected mesos to improve'}</th><th scope="col">Flame score / 100M mesos</th></tr></thead>
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
              {category === 'starforce' && <td>{number(entry.expected_booms)}</td>}
              <td>{number(entry.action_cost_mesos)}</td>
              <td>{signed(entry.gain_per_meso == null ? null : entry.gain_per_meso * 100_000_000)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p role="status">No eligible items for this ranking. Check the unavailable estimates below.</p>}
        {category !== 'flames' && category !== 'overall' && rankings.unavailable?.length > 0 && <details className="upgrade-notes">
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
          with replacement spending equal to expected booms times the item's replacement cost. Shining Star Force Sunday
          is included when enabled, discounts Star Force costs at every star by 30%, and reduces 15★–21★ boom rates by 30%.
          The selected MVP rank discount also applies through 17★. Cost discounts combine multiplicatively; for safeguarded
          attempts, they apply to the base-cost portion while the safeguard surcharge remains unchanged.
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
