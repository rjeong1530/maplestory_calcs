import { LoadingPlaceholder } from '../ui/loading'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { POTENTIAL_LABELS, FLAME_LABELS } from '../data/equipmentLines'
import { FLAME_SLOTS, potentialEquipmentType } from '../data/flameEquipment'
import { maxStarForceForEquipment, supportsStarForce, replacementCostForEquipment } from '../data/starforce'
import EquipmentLaddering from './EquipmentLaddering'
import { isAstraSecondary } from '../data/laddering'

const emptyPotentialLine = () => ({ effect: '', value: '' })

export default function EquipmentAnalysis({ slot, item, offenseStat, onChange, onOpenApproaches, secondCopy = false }) {
  const [itemOptions, setItemOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [bossEquipment, setBossEquipment] = useState(
    item.config.boss_equipment ?? item.currentBossEquipment ?? false)

  const potentialType = potentialEquipmentType(slot, item)
  const supportsFlames = FLAME_SLOTS.has(item.slot)
  const maximumStarForce = maxStarForceForEquipment(item)
  const canStarForce = supportsStarForce(item, slot)
  const currentStarForce = Math.min(item.currentStarForce ?? 0, maximumStarForce)
  const optionsKey = JSON.stringify([
    item.config.equipment_level, item.config.equipment_type, potentialType, supportsFlames,
    bossEquipment, item.config.base_weapon_offense,
  ])
  const availableOptions = itemOptions?.key === optionsKey ? itemOptions.data : null
  const potentialLines = item.currentPotential || []
  const flameLines = item.currentFlames || []
  const potentialValuesByLine = availableOptions?.potential.values_by_line || []
  const flameValues = availableOptions?.flame_values || []
  const flameTotals = {}
  for (const line of flameLines) {
    const option = flameValues.find(row => row.option === line.option)
    const stageValues = option?.values.find(value => Number(value.stage) === Number(line.stage))
    for (const { stat, value } of stageValues?.values || []) {
      flameTotals[stat] = (flameTotals[stat] || 0) + Number(value)
    }
  }
  const orderedFlameValues = Object.keys(FLAME_LABELS)
    .flatMap(option => flameValues.filter(row => row.option === option))

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      level: String(item.config.equipment_level),
      cube_type: 'black',
      boss_equipment: String(bossEquipment),
    })
    if (potentialType) params.set('potential_equipment_type', potentialType)
    if (supportsFlames) params.set('flame_equipment_type', item.config.equipment_type)
    if (item.config.equipment_type === 'weapon') {
      params.set('offense_stat', offenseStat)
      params.set('base_weapon_offense', String(item.config.base_weapon_offense))
    }

    apiRequest(`/api/item-options?${params}`, { signal: controller.signal })
      .then(options => {
        setItemOptions({ key: optionsKey, data: options })
        setOptionsError('')
      })
      .catch(error => {
        if (!controller.signal.aborted) setOptionsError(error.message)
      })
    return () => controller.abort()
  }, [item.config.equipment_level, item.config.equipment_type, potentialType,
    supportsFlames, bossEquipment, item.config.base_weapon_offense, offenseStat, optionsKey])

  function updatePotential(index, patch) {
    const lines = Array.from({ length: 3 }, (_, lineIndex) =>
      potentialLines[lineIndex] || emptyPotentialLine())
    lines[index] = { ...lines[index], ...patch }
    onChange({ currentPotential: lines })
  }

  function updateBossEquipment(value) {
    setBossEquipment(value)
    onChange({ currentBossEquipment: value })
  }

  function updateStarForce(value) {
    if (value === '') return
    const starForce = Number(value)
    if (Number.isInteger(starForce)) {
      onChange({ currentStarForce: Math.min(maximumStarForce, Math.max(0, starForce)) })
    }
  }

  function toggleFlame(option, stage) {
    const existingIndex = flameLines.findIndex(line => line.option === option)
    if (existingIndex >= 0 && Number(flameLines[existingIndex].stage) === stage) {
      onChange({ currentFlames: flameLines.filter((_, index) => index !== existingIndex) })
    } else if (existingIndex >= 0) {
      onChange({ currentFlames: flameLines.map((line, index) =>
        index === existingIndex ? { ...line, stage } : line) })
    } else if (flameLines.length < 4) {
      onChange({ currentFlames: [...flameLines, { option, stage }] })
    }
  }

  function flameValueText(values, option) {
    const formattedValues = values.map(({ value }) =>
      Number.isInteger(value) ? value : Number(value.toFixed(2)))
    const text = formattedValues.join(' + ')
    return option.endsWith('_PCT') || values.some(({ stat }) => stat.endsWith('_PCT'))
      ? `${text}%`
      : text
  }

  function formatFlameTotal(value) {
    return Number.isInteger(value) ? value : Number(value.toFixed(2))
  }

  return (
    <div className="equipment-analysis border-t border-solid border-t-outline py-3 px-0 @container
        @min-[640px]:[&_.equipment-analysis-sections]:grid-cols-2 @min-[640px]:[&_.equipment-analysis-sections]:gap-6
        [&_.equipment-approach-link]:inline-flex [&_.equipment-approach-link]:items-center
        [&_.equipment-approach-link]:justify-between [&_.equipment-approach-link]:gap-5
        [&_.equipment-approach-link]:max-w-full [&_.equipment-approach-link]:mb-3 [&_.equipment-approach-link]:py-2.75
        [&_.equipment-approach-link]:px-3.5 [&_.equipment-approach-link]:border
        [&_.equipment-approach-link]:border-solid [&_.equipment-approach-link]:border-[var(--border)]
        [&_.equipment-approach-link]:rounded-sm [&_.equipment-approach-link]:bg-[var(--surface-secondary)]
        [&_.equipment-approach-link]:text-[var(--success-ink)] [&_.equipment-approach-link]:text-[13px]
        [&_.equipment-approach-link]:font-semibold [&_.equipment-approach-link]:leading-[1.5]
        [&_.equipment-approach-link]:text-left
        [&_.equipment-approach-link]:[transition:background-color_150ms_ease,_border-color_150ms_ease]
        [&_.equipment-approach-link:hover:not(:disabled)]:bg-[var(--surface-selected)]
        [&_.equipment-approach-link:hover:not(:disabled)]:border-[var(--success-ink)] [&_.equipment-mode-table]:min-w-0
        [&_.equipment-mode-table]:table-fixed [&_.equipment-mode-table]:text-[12px]
        [&_.equipment-mode-table_th]:w-[50%] [&_.equipment-mode-table_th]:py-1.5 [&_.equipment-mode-table_th]:px-1
        [&_.equipment-mode-table_td]:w-[50%] [&_.equipment-mode-table_td]:py-1.5 [&_.equipment-mode-table_td]:px-1
        [&_.equipment-mode-table_td_select]:max-w-22.5 [&_.equipment-mode-table_td_select]:py-1.25
        [&_.equipment-mode-table_td_select]:px-1 [&_.equipment-mode-table_td_select]:text-[12px]
        [&_.equipment-safeguard-control]:flex-row [&_.equipment-safeguard-control]:items-center
        [&_.equipment-safeguard-control]:justify-center [&_.equipment-safeguard-control]:gap-1
        [&_.equipment-safeguard-control]:mt-1.25 [&_.equipment-safeguard-control]:mx-0
        [&_.equipment-safeguard-control]:mb-0 [&_.equipment-safeguard-control]:text-[11px] [&_label]:my-1.5
        [&_label]:mx-0">
      <div className="equipment-analysis-sections grid grid-cols-1 gap-3.5 [&_>_section]:min-w-0 [&_h4]:mt-0 [&_h4]:mx-0 [&_h4]:mb-3 [&_h4]:text-[14px]">
        <section className="current-potential-section [&_>_label]:gap-1.25 [&_>_label]:text-[11px] [&_select]:py-1.75 [&_select]:px-2">
          <h4>Current potential</h4>
          {slot === 'hat' && !secondCopy && <>
            <label>Minimum cooldown reduction for upgrades
              <select value={item.minimumCooldownSeconds ?? 0}
                onChange={event => onChange({ minimumCooldownSeconds: Number(event.target.value) })}>
                {[0, 1, 2, 3, 4, 5, 6].map(seconds => <option key={seconds} value={seconds}>
                  {seconds ? `${seconds} seconds` : 'No minimum'}
                </option>)}
              </select>
            </label>
            {item.minimumCooldownSeconds > 0 && <p className="hint text-[12px] text-subtle mb-4.5">
              Upgrade rankings require at least {item.minimumCooldownSeconds}s cooldown reduction,
              reserving at least {Math.ceil(item.minimumCooldownSeconds / 2)} potential line(s) for cooldown.
              Rolls below this minimum never count as upgrades. This does not change your recorded current lines.
              Use Black cubes to keep your existing hat potential while searching; individual lines are not physically locked during cubing.
            </p>}
          </>}
          {optionsError ? <p className="error text-[var(--danger-ink)] bg-[var(--danger-bg)] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{optionsError}</p>
            : !availableOptions ? <LoadingPlaceholder label={<>Loading potential options…</>} />
              : !availableOptions.potential.available ? (
                <p className="hint text-[12px] text-subtle mb-4.5">No potential chart is available for this equipment and level.</p>
              ) : (
                <div className="current-potential-lines [&_.current-stat-row]:grid-cols-[minmax(0,_1fr)_68px] [&_.current-stat-row]:gap-1.5
        [&_.current-stat-row]:my-1.75 [&_.current-stat-row]:mx-0 [&_.current-stat-row_label]:gap-1.25
        [&_.current-stat-row_label]:text-[10px]">
                  {Array.from({ length: 3 }, (_, index) => {
                    const line = potentialLines[index] || emptyPotentialLine()
                    const lineOptions = potentialValuesByLine[index]?.values || {}
                    const effects = Object.keys(lineOptions)
                    const values = lineOptions[line.effect] || []
                    const lineValue = values.some(value => String(value) === String(line.value))
                      ? String(line.value) : ''
                    return (
                      <div className="current-stat-row grid grid-cols-[minmax(0,_1fr)_92px] items-end gap-2.5 my-3 mx-0" key={index}>
                        <label>Line {index + 1}
                          <select value={line.effect} onChange={event => updatePotential(index, {
                            effect: event.target.value, value: '',
                          })}>
                            <option value="">Empty</option>
                            {effects.map(effect => (
                              <option key={effect} value={effect}>
                                {POTENTIAL_LABELS[effect] || effect}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>Value
                          <select value={lineValue} disabled={!line.effect}
                            onChange={event => updatePotential(index, { value: event.target.value })}>
                            <option value="">Select</option>
                            {values.map(value => (
                              <option key={value} value={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )
                  })}
                </div>
              )}
          {canStarForce && !secondCopy && <details className="equipment-mode-details mt-4 border border-solid border-outline rounded-sm py-2.5 px-3 [&_>_summary]:cursor-pointer
        [&_>_summary]:text-[var(--text-secondary)] [&_>_summary]:text-[13px] [&_>_summary]:font-semibold [&[open]_>_summary]:mb-3
        [&_>_summary:focus-visible]:outline-offset-[4px]">
          <summary>Star Force modes & safeguards</summary>
          <button type="button" className="equipment-approach-link [&_svg]:shrink-0" onClick={onOpenApproaches}>
            Compare Star Force approaches
            <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" className="fill-none">
              <path d="M4 10h12m-5-5 5 5-5 5" className="stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]" />
            </svg>
          </button>
          <p className="hint text-[12px] text-subtle mb-4.5">Choose the mode for each star upgrade. These choices apply to upgrade order costs,
            including recovery. Safeguard at 15–17 stars uses Mode 1 and prevents booms.</p>
          <div className="overflow-x-auto">
            <table className="starforce-mode-table min-w-110 m-0 [@media(max-width:480px)]:w-full [@media(max-width:480px)]:min-w-0
        [@media(max-width:480px)]:table-fixed [&_th]:py-2 [&_th]:px-2.5 [&_th]:[vertical-align:middle] [&_td]:py-2
        [&_td]:px-2.5 [&_td]:[vertical-align:middle] [&_th:last-child]:text-center [&_td:last-child]:text-center
        [&_td_select]:p-2 [@media(max-width:480px)]:[&_th]:py-2 [@media(max-width:480px)]:[&_th]:px-1
        [@media(max-width:480px)]:[&_td]:py-2 [@media(max-width:480px)]:[&_td]:px-1
        [@media(max-width:480px)]:[&_th:first-child]:w-[31.5%] [@media(max-width:480px)]:[&_td:first-child]:w-[31.5%]
        [@media(max-width:480px)]:[&_th:nth-child(2)]:w-[38.5%] [@media(max-width:480px)]:[&_td:nth-child(2)]:w-[38.5%]
        [@media(max-width:480px)]:[&_th:last-child]:w-[30%] [@media(max-width:480px)]:[&_td:last-child]:w-[30%]
        [@media(max-width:480px)]:[&_td_select]:py-2 [@media(max-width:480px)]:[&_td_select]:px-1
        [@media(max-width:480px)]:[&_td_select]:text-[12px] equipment-mode-table">
              <thead><tr><th scope="col">Stars</th><th scope="col">Enhancement mode</th></tr></thead>
              <tbody>{Array.from({ length: Math.max(0, Math.min(maximumStarForce, 22) - 15) }, (_, index) => index + 15).map(star => (
                <tr key={star}>
                  <th scope="row">{star}★ to {star + 1}★</th>
                  <td>
                    <select aria-label={`Equipment enhancement mode from ${star} stars`}
                      disabled={item.starForceSafeguards?.[star] === true}
                      value={item.starForceSafeguards?.[star] ? 1 : item.starForceModes?.[star] ?? 1}
                      onChange={event => onChange({ starForceModes: {
                        ...item.starForceModes, [star]: Number(event.target.value),
                      } })}>
                      {(star <= 17 ? [1, 2, 3] : [1, 2, 3, 4]).map(mode => (
                        <option key={mode} value={mode}>Mode {mode}</option>
                      ))}
                    </select>
                    {star <= 17 && <label className="equipment-safeguard-control [&_input]:w-auto [&_input]:m-0">
                      <input type="checkbox" checked={item.starForceSafeguards?.[star] ?? false}
                        aria-label={`Safeguard equipment from ${star} stars`}
                        onChange={event => onChange({ starForceSafeguards: {
                          ...item.starForceSafeguards, [star]: event.target.checked,
                        } })} />
                      Safeguard
                    </label>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          </details>}
        </section>

      {canStarForce ? <section className="current-starforce-section flex flex-wrap items-start justify-between gap-y-3 gap-x-5 content-start
        [&_>_div:first-child]:basis-[100%] [&_.hint]:m-0 [&_.hint]:text-[11px]" aria-label="Current Star Force">
        <div>
          <h4>Current Star Force</h4>
          <p className="hint text-[12px] text-subtle mb-4.5">Maximum for level {item.config.equipment_level}: {maximumStarForce}★</p>
        </div>
        <label className="current-starforce-control min-w-32.5 m-0">Current stars
          <span className="current-starforce-input flex items-center gap-2 [&_input]:w-20 [&_input]:py-1.75 [&_input]:px-2
        [&_>_span]:text-subtle [&_>_span]:text-[12px] [&_>_span]:whitespace-nowrap">
            <input type="number" min="0" max={maximumStarForce} step="1"
              aria-label="Current Star Force"
              value={currentStarForce} onChange={event => updateStarForce(event.target.value)} />
            <span>/ {maximumStarForce}★</span>
          </span>
        </label>
        {!secondCopy && <><label className="current-starforce-control min-w-32.5 m-0">Max Star Force for upgrades
          <input type="number" min="0" max={maximumStarForce} step="1"
            value={item.maxStarForce ?? maximumStarForce}
            onChange={event => {
              const value = Number(event.target.value)
              if (event.target.value !== '' && Number.isInteger(value)) {
                onChange({ maxStarForce: Math.min(maximumStarForce, Math.max(0, value)) })
              }
            }} />
          <small>Upgrade recommendations stop here.</small>
        </label>
        <label className="current-starforce-control min-w-32.5 m-0">Replacement cost per boom (mesos)
          <input type="number" min="0" step="any"
            value={replacementCostForEquipment(item, slot)}
            onChange={event => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && value >= 0) onChange({ replacementCostMesos: value })
            }} />
          <small>Astra secondaries default to 1 billion mesos. You can override this.</small>
        </label>
        {isAstraSecondary(item, slot)
          ? <p className="hint text-[12px] text-subtle mb-4.5">Astra secondaries cannot be laddered.</p>
          : <EquipmentLaddering item={item} cap={maximumStarForce} onChange={onChange} />}
        </>}
      </section> : <p className="hint text-[12px] text-subtle mb-4.5">Starforce is not supported for this equipment.</p>}

        <section className="col-span-full border-t border-outline pt-4">
          <h4>Current flames</h4>
          {!supportsFlames ? <p className="hint text-[12px] text-subtle mb-4.5">Flames are not supported for this slot.</p>
            : optionsError ? <p className="error text-[var(--danger-ink)] bg-[var(--danger-bg)] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{optionsError}</p>
              : !availableOptions ? <LoadingPlaceholder label={<>Loading flame options…</>} />
                : (
                  <>
                    {item.needsFlameType && !secondCopy && <label className="flame-checkbox flex-row items-center gap-2 mt-4.5 [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
                        <input type="checkbox" checked={bossEquipment}
                          onChange={event => updateBossEquipment(event.target.checked)} />
                        Boss / special equipment
                      </label>}
                    <div className="flame-tier-ranges flex flex-wrap gap-1.5 my-3 mx-0 [&_span]:border [&_span]:border-solid [&_span]:border-outline
        [&_span]:rounded-[999px] [&_span]:py-1 [&_span]:px-2 [&_span]:text-[var(--text-secondary)] [&_span]:text-[10px]">
                      {Object.entries(availableOptions.flame_tier_ranges).map(([type, [min, max]]) => (
                        <span key={type}>{type}: Tiers {min}–{max}</span>
                      ))}
                    </div>
                    <p className="hint text-[12px] text-subtle mb-4.5">Select up to four cells to record this item's current flame lines.</p>
                    <div className="max-w-full">
                      <table className="flame-values-table table-fixed mt-3 mx-0 mb-0 text-[11px] [&_th]:py-1.25 [&_th]:px-0.5 [&_th]:whitespace-normal
        [&_th]:[overflow-wrap:anywhere] [&_th]:text-center [&_td]:py-1.25 [&_td]:px-0.5 [&_td]:whitespace-normal
        [&_td]:[overflow-wrap:anywhere] [&_td]:text-center [&_th:first-child]:w-[24%] [&_th:first-child]:text-left">
                        <thead>
                          <tr>
                            <th scope="col">Flame option</th>
                            {availableOptions.flame_stages.map(stage => (
                              <th scope="col" key={stage}>Tier {stage}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {orderedFlameValues.map(row => (
                              <tr key={row.option}>
                                <th scope="row">{FLAME_LABELS[row.option] || row.option}</th>
                                {availableOptions.flame_stages.map(stage => {
                                  const stageValue = row.values.find(value => value.stage === stage)
                                  const isSelected = flameLines.some(line =>
                                    line.option === row.option && Number(line.stage) === stage)
                                  return (
                                    <td key={stage}>
                                      {stageValue ? <button type="button"
                                        className="flame-value-cell w-full min-w-0 py-1.75 px-0.5 whitespace-normal [overflow-wrap:anywhere] border-transparent text-[11px] tabular-nums [&[aria-pressed='true']]:text-[var(--surface-secondary)] [&[aria-pressed='true']]:border-accent [&[aria-pressed='true']]:bg-accent [&:disabled]:opacity-40"
                                        aria-pressed={isSelected}
                                        aria-label={`${FLAME_LABELS[row.option] || row.option}, tier ${stage}: ${flameValueText(stageValue.values, row.option)}`}
                                        disabled={!isSelected && flameLines.length >= 4
                                          && !flameLines.some(line => line.option === row.option)}
                                        onClick={() => toggleFlame(row.option, stage)}>
                                        {flameValueText(stageValue.values, row.option)}
                                      </button> : '—'}
                                    </td>
                                  )
                                })}
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="current-flame-totals mt-3.5 py-2.5 px-3 border border-solid [&_h5]:mt-0 [&_h5]:mx-0 [&_h5]:mb-2 [&_h5]:text-subtle [&_h5]:text-[11px] [&_h5]:uppercase [&_h5]:tracking-[0.04em] [&_ul]:flex [&_ul]:flex-wrap [&_ul]:gap-1.5 [&_ul]:list-none [&_ul]:m-0 [&_ul]:p-0 [&_li]:flex [&_li]:gap-1.5 [&_li]:items-center [&_li]:border [&_li]:border-solid [&_li]:border-outline [&_li]:rounded-[999px] [&_li]:py-1 [&_li]:px-2 [&_li]:text-[var(--text-secondary)] [&_li]:text-[11px] [&_li_strong]:text-accent [&_li_strong]:tabular-nums [&_.hint]:m-0 [&_.hint]:text-[11px]" aria-live="polite">
                      <h5>Selected flame totals</h5>
                      {Object.keys(flameTotals).length
                        ? <ul>
                            {Object.entries(flameTotals).map(([stat, value]) => (
                              <li key={stat}>
                                <span>{FLAME_LABELS[stat] || stat}</span>
                                <strong>{formatFlameTotal(value)}
                                  {stat.endsWith('_PCT') ? '%' : ''}
                                </strong>
                              </li>
                            ))}
                          </ul>
                        : <p className="hint text-[12px] text-subtle mb-4.5">Select flame values to see their combined totals.</p>}
                    </div>
                  </>
                )}
        </section>
      </div>

    </div>
  )
}
