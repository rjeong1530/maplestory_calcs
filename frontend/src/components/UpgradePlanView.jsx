import { LoadingPlaceholder } from '../ui/loading'
import { LoadingButtonContent } from '../ui/loading'


import { SLOT_LABELS } from '../data/flameEquipment'
import { UPGRADE_CATEGORIES, MVP_RANKS, FLAME_WEIGHT_LABELS, POTENTIAL_WEIGHT_LABELS } from '../data/equipmentUpgrade'
import { cubeCostLabel } from '../data/cubeCosts'
import FlameUpgradeOrder from './FlameUpgradeOrder'
import OverallUpgradeOrder from './OverallUpgradeOrder'

const CATEGORIES = UPGRADE_CATEGORIES
const slotName = slot => { const [type, index] = slot.split('-'); return `${SLOT_LABELS[type] || type}${index ? ` ${index}` : ''}` }
import UpgradeRankTable from './UpgradeRankTable'
import { useState } from 'react'
import './upgrade-workshop.css'

export default function UpgradePlanView({ equipment, equipmentClass, classStats, flameWeights, settings, onSettingsChange, onFlameWeightChange, category, setCategory, flameType, setFlameType, payload, current, busy, result, request, rankings, flameRankings, rows, groupedRows, submit }) {
  // Presentation history only; never changes ranking order or calculation state.
  const [history, setHistory] = useState({ result: null, category: null, ranks: {}, previous: {} })
  if (result && (history.result !== result || history.category !== category)) {
    setHistory({ result, category, previous: history.ranks, ranks: { ...history.ranks,
      [category]: Object.fromEntries(rows.map((entry, index) => [`${entry.slot}-${entry.start_star ?? 'roll'}`, index])),
    } })
  }
  const prior = history.previous[category] || {}
  return (
    <section className="upgrade-plan workshop-upgrade-plan" aria-labelledby="upgrade-heading">
      <span className="eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-accent">YOUR NEXT UPGRADE</span>
      <h2 id="upgrade-heading">Equipment Upgrade Order</h2>
      <p className="upgrade-subtitle">Get the most efficient upgrade path for your character based on cost and gain.</p>
      <p className="hint text-[12px] text-subtle mb-4.5">Compare future Star Force steps and the next roll improvement on each equipped item for {equipmentClass}:
        {' '}{[classStats.main].flat().join(' / ')} primary,
        {' '}{classStats.secondary.length ? `${classStats.secondary.join(' / ')} secondary` : 'no secondary stat'}, {classStats.offense}.
        Record current stars, potential and flames above; unrecorded bonuses count as zero.</p>
      <div className="upgrade-workshop-layout">
      <form onSubmit={submit} className="upgrade-settings-sidebar upgrade-settings-top">
        <div className="upgrade-settings-heading"><h3>Settings</h3><p className="mw-help">{equipmentClass} · {payload.laddering_enabled ? 'Laddering' : 'Standard'} mode</p></div>
        <details className="upgrade-settings-help"><summary>Equipment and laddering settings</summary>
        <p className="hint text-[12px] text-subtle mb-4.5">Each item's laddering checkbox enforces its starting threshold in the Overall tab. SoS transfer mode shows equipped and spare transfer alternatives.
          Items without laddering settings use standard upgrades. Record second-copy stats in Current equipment stats; minimum scores are calculated automatically.</p>
          <p className="hint">Flame results include Black and Abyssal Flames. Star Force uses each item's enhancement modes.</p></details>
        <fieldset className="upgrade-categories flex-wrap mb-4 [&_label]:flex [&_label]:items-center [&_label]:gap-1.6 [&_input]:w-auto">
          <legend>Upgrade orders to calculate</legend>
          {Object.entries(CATEGORIES).map(([key, label]) => <label key={key}>
            <input type="checkbox" checked={settings.categories.includes(key)}
              onChange={event => onSettingsChange({ ...settings, categories: event.target.checked
                ? [...settings.categories, key] : settings.categories.filter(value => value !== key) })} />
            {label}
          </label>)}
        </fieldset>
        <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
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
        <label className="cube-sale-control flex-row items-center gap-2.5 my-5 mx-0 leading-[1.5] cursor-pointer [&_input]:shrink-0
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
          <input type="checkbox" checked={settings.cube_sale}
            onChange={event => onSettingsChange({ ...settings, cube_sale: event.target.checked })} />
          <span>Cube sale (25% off black and red cubes)</span>
        </label>
        <div className="upgrade-controls flex-wrap items-end my-5 mx-0 [&_label]:[flex:1] [&_label]:min-w-55">
          <label>Potential cube
            <select value={settings.cube_type}
              onChange={event => onSettingsChange({ ...settings, cube_type: event.target.value })}>
              <option value="black">Black cube</option>
              <option value="red">Red cube</option>
            </select>
            <span className="cube-price text-subtle text-[12px] font-normal leading-[1.5]" aria-live="polite">{cubeCostLabel(settings.cube_type, settings.cube_sale)}</span>
          </label>
        </div>
        <div className="upgrade-weight-groups">
        <fieldset className="upgrade-weights grid mb-6 [&_legend]:text-[15px] [&_legend]:mb-3.5">
          <legend>Potential score weights</legend>
          {Object.entries(POTENTIAL_WEIGHT_LABELS).map(([key, label]) => (
            <label key={key}>{label}
              <input type="number" min="0" step="any" required value={settings[key]}
                onChange={event => onSettingsChange({ ...settings, [key]: event.target.value })} />
            </label>
          ))}
        </fieldset>
        <fieldset className="upgrade-weights grid mb-6 [&_legend]:text-[15px] [&_legend]:mb-3.5">
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
        </div>
        <button type="submit" className="mw-submit-button font-bold p-3.5" disabled={busy || !payload.equipment.length || !settings.categories.length}>
          <LoadingButtonContent busy={busy} label="Calculating upgrade order…">Calculate upgrade order</LoadingButtonContent>
        </button>
      </form>
      <div className="upgrade-recommendations"><h3>Recommended Upgrade Order</h3>
      {!settings.categories.length && <p className="hint text-[12px] text-subtle mb-4.5">Select at least one upgrade order.</p>}
      {!payload.equipment.length && <p className="hint text-[12px] text-subtle mb-4.5">Equip an item above to compare upgrades.</p>}
      <div aria-live="polite">
        {busy && <LoadingPlaceholder variant="table" label={<>Calculating expected gains for {payload.equipment.length} items…</>} />}
        {request && !current && <p className="hint text-[12px] text-subtle mb-4.5">Inputs changed. Calculate again to refresh the rankings.</p>}
      </div>
      {current?.error && <p className="error text-[var(--danger-ink)] bg-[var(--danger-bg)] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{current.error}</p>}
      {result && <>
        <div className="upgrade-results-controls flex flex-wrap items-end gap-4.5 my-5 mx-0">
          <div className="upgrade-category-tabs [&_button]:min-h-11 [&_button]:font-semibold [&_button]:[transition:background-color_150ms,_color_150ms,_border-color_150ms]" role="group" aria-label="Upgrade category">
            {Object.entries(CATEGORIES).filter(([key]) => settings.categories.includes(key)).map(([key, label]) => (
              <button type="button" key={key} aria-pressed={category === key}
                onClick={() => setCategory(key)}>{label}</button>
            ))}
            <button type="button" aria-pressed={category === 'overall'}
              onClick={() => setCategory('overall')}>Overall</button>
          </div>
        </div>

        <details className="upgrade-ranking-context" hidden={category === 'flames' || category === 'overall'}><summary>Ranking assumptions and prerequisites</summary>
        {category !== 'flames' && category !== 'overall' && <p className="hint text-[12px] text-subtle mb-4.5">Scores are weighted stat points. Gain is measured for each star range or first better roll.
          Efficiency is displayed as flame score gain per 100M mesos.</p>}
        {category === 'starforce' && <p className="hint text-[12px] text-subtle mb-4.5">
          Showing the top {rows.length} of {groupedRows.length} upgrade ranges in the selected order.{' '}
          Consecutive steps for the same item are combined, with total costs and gains for the range.
          Later ranges require reaching their starting star first; costs and gains exclude those earlier steps.
          Each item's earlier upgrades appear first. Best gain per meso compares ranges of one to six
          additional stars per item. Items below 15 stars also compare targets from 16 to 21 stars to
          account for post-15 gains. Every range uses total gain divided by total expected cost,
          including all prerequisite steps. After choosing a range, it compares again from the new star levels. Consecutive ranges
          for the same item are combined, so a displayed range may exceed six stars.
        </p>}
        </details>
        {category === 'overall' ? <OverallUpgradeOrder plan={result.overall_upgrade_order}
          settings={settings} cubeType={settings.cube_type} equipment={equipment} />
          : category === 'flames' ? <div className="grid gap-7">
          <div className="flame-type-toggle flex justify-center justify-self-center flex-wrap gap-2 [&_button]:justify-center
        [&_button]:w-13 [&_button]:h-13 [&_button]:p-2 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2
        [&_img]:object-contain [&_img]:[image-rendering:pixelated]" role="group" aria-label="Flame results to display">
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
        </div> : rows.length ? <UpgradeRankTable rows={rows} category={category} equipment={equipment} previousRanks={prior} /> : <p role="status">No eligible items for this ranking. Check the unavailable estimates below.</p>}
        {category !== 'flames' && category !== 'overall' && rankings.unavailable?.length > 0 && <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] [&_summary]:cursor-pointer [&_li]:mb-2">
          <summary>Unavailable {CATEGORIES[category]} estimates ({rankings.unavailable.length})</summary>
          <ul>{rankings.unavailable.map(entry => <li key={entry.slot}>
            <strong>{entry.name}</strong> ({slotName(entry.slot)}
            {entry.next_star != null ? ` · ${entry.start_star} → ${entry.next_star} stars` : ''}): {entry.note}
          </li>)}</ul>
        </details>}
        {result.excluded_superior_equipment.length > 0 && <p className="hint text-[12px] text-subtle mb-4.5">
          Excluded Superior equipment: {result.excluded_superior_equipment
            .map(entry => `${entry.name} (${slotName(entry.slot)})`).join(', ')}.
        </p>}
      </>}
      <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] [&_summary]:cursor-pointer [&_li]:mb-2">
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
      </div></div>
    </section>
  )
}
