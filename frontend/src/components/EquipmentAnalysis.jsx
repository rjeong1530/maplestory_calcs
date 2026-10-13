import LoadingStatus from './LoadingStatus'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { POTENTIAL_LABELS, FLAME_LABELS } from '../data/equipmentLines'
import { FLAME_SLOTS, potentialEquipmentType } from '../data/flameEquipment'
import { maxStarForceForEquipment, supportsStarForce, replacementCostForEquipment } from '../data/starforce'
import './EquipmentAnalysis.css'
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
    <div className="equipment-analysis">
      <div className="equipment-analysis-sections">
        <section className="current-potential-section">
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
            {item.minimumCooldownSeconds > 0 && <p className="hint">
              Upgrade rankings require at least {item.minimumCooldownSeconds}s cooldown reduction,
              reserving at least {Math.ceil(item.minimumCooldownSeconds / 2)} potential line(s) for cooldown.
              Rolls below this minimum never count as upgrades. This does not change your recorded current lines.
              Use Black cubes to keep your existing hat potential while searching; individual lines are not physically locked during cubing.
            </p>}
          </>}
          {optionsError ? <p className="error" role="alert">{optionsError}</p>
            : !availableOptions ? <LoadingStatus>Loading potential options…</LoadingStatus>
              : !availableOptions.potential.available ? (
                <p className="hint">No potential chart is available for this equipment and level.</p>
              ) : (
                <div className="current-potential-lines">
                  {Array.from({ length: 3 }, (_, index) => {
                    const line = potentialLines[index] || emptyPotentialLine()
                    const lineOptions = potentialValuesByLine[index]?.values || {}
                    const effects = Object.keys(lineOptions)
                    const values = lineOptions[line.effect] || []
                    const lineValue = values.some(value => String(value) === String(line.value))
                      ? String(line.value) : ''
                    return (
                      <div className="current-stat-row" key={index}>
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
          {canStarForce && !secondCopy && <details className="equipment-mode-details">
          <summary>Star Force modes & safeguards</summary>
          <button type="button" className="equipment-approach-link" onClick={onOpenApproaches}>
            Compare Star Force approaches
            <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
              <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="hint">Choose the mode for each star upgrade. These choices apply to upgrade order costs,
            including recovery. Safeguard at 15–17 stars uses Mode 1 and prevents booms.</p>
          <div className="overflow-x-auto">
            <table className="starforce-mode-table equipment-mode-table">
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
                    {star <= 17 && <label className="equipment-safeguard-control">
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

      {canStarForce ? <section className="current-starforce-section" aria-label="Current Star Force">
        <div>
          <h4>Current Star Force</h4>
          <p className="hint">Maximum for level {item.config.equipment_level}: {maximumStarForce}★</p>
        </div>
        <label className="current-starforce-control">Current stars
          <span className="current-starforce-input">
            <input type="number" min="0" max={maximumStarForce} step="1"
              aria-label="Current Star Force"
              value={currentStarForce} onChange={event => updateStarForce(event.target.value)} />
            <span>/ {maximumStarForce}★</span>
          </span>
        </label>
        {!secondCopy && <><label className="current-starforce-control">Max Star Force for upgrades
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
        <label className="current-starforce-control">Replacement cost per boom (mesos)
          <input type="number" min="0" step="any"
            value={replacementCostForEquipment(item, slot)}
            onChange={event => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && value >= 0) onChange({ replacementCostMesos: value })
            }} />
          <small>Astra secondaries default to 1 billion mesos. You can override this.</small>
        </label>
        {isAstraSecondary(item, slot)
          ? <p className="hint">Astra secondaries cannot be laddered.</p>
          : <EquipmentLaddering item={item} cap={maximumStarForce} onChange={onChange} />}
        </>}
      </section> : <p className="hint">Starforce is not supported for this equipment.</p>}

        <section className="col-span-full border-t border-rule pt-4">
          <h4>Current flames</h4>
          {!supportsFlames ? <p className="hint">Flames are not supported for this slot.</p>
            : optionsError ? <p className="error" role="alert">{optionsError}</p>
              : !availableOptions ? <LoadingStatus>Loading flame options…</LoadingStatus>
                : (
                  <>
                    {item.needsFlameType && !secondCopy && <label className="flame-checkbox">
                        <input type="checkbox" checked={bossEquipment}
                          onChange={event => updateBossEquipment(event.target.checked)} />
                        Boss / special equipment
                      </label>}
                    <div className="flame-tier-ranges">
                      {Object.entries(availableOptions.flame_tier_ranges).map(([type, [min, max]]) => (
                        <span key={type}>{type}: Tiers {min}–{max}</span>
                      ))}
                    </div>
                    <p className="hint">Select up to four cells to record this item's current flame lines.</p>
                    <div className="max-w-full">
                      <table className="flame-values-table">
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
                                        className="flame-value-cell"
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
                    <div className="current-flame-totals" aria-live="polite">
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
                        : <p className="hint">Select flame values to see their combined totals.</p>}
                    </div>
                  </>
                )}
        </section>
      </div>

    </div>
  )
}
