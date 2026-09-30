import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { FLAME_SLOTS, potentialEquipmentType } from '../data/flameEquipment'

const POTENTIAL_LABELS = {
  STR_PCT: 'STR %', DEX_PCT: 'DEX %', INT_PCT: 'INT %', LUK_PCT: 'LUK %',
  ALL_STAT_PCT: 'All stats %', MAX_HP_PCT: 'Max HP %', MAX_MP_PCT: 'Max MP %',
  ATT_PCT: 'Attack %', MAGIC_ATT_PCT: 'Magic attack %', BOSS_DAMAGE_PCT: 'Boss damage %',
  DAMAGE_PCT: 'Damage %', IED_PCT: 'Ignore enemy defense %',
  CRIT_RATE_PCT: 'Critical rate %', CRIT_DAMAGE_PCT: 'Critical damage %',
  MESO_PCT: 'Meso obtained %', DROP_PCT: 'Item drop rate %',
  COOLDOWN_SEC: 'Cooldown reduction',
}

const FLAME_LABELS = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  'STR+DEX': 'STR + DEX', 'STR+INT': 'STR + INT', 'STR+LUK': 'STR + LUK',
  'DEX+INT': 'DEX + INT', 'DEX+LUK': 'DEX + LUK', 'INT+LUK': 'INT + LUK',
  MAX_HP: 'Max HP', MAX_MP: 'Max MP', LEVEL_REDUCTION: 'Level reduction',
  DEF: 'Defense', ATT: 'Attack', MATT: 'Magic attack',
  BOSS_DAMAGE_PCT: 'Boss damage %', DAMAGE_PCT: 'Damage %',
  ALL_STAT_PCT: 'All stats %', MOVE_SPEED: 'Movement speed', JUMP: 'Jump',
}

const emptyPotentialLine = () => ({ effect: '', value: '' })

export default function EquipmentAnalysis({ slot, item, offenseStat, onChange }) {
  const [itemOptions, setItemOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [bossEquipment, setBossEquipment] = useState(
    item.config.boss_equipment ?? item.currentBossEquipment ?? false)

  const potentialType = potentialEquipmentType(slot, item)
  const supportsFlames = FLAME_SLOTS.has(item.slot)
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
  const combinedFlameOptions = [
    'STR+DEX', 'STR+INT', 'STR+LUK', 'DEX+INT', 'DEX+LUK', 'INT+LUK',
  ]
  const flameGroups = [
    {
      label: 'Common flame stats',
      rows: flameValues.filter(row => [
        'STR', 'DEX', 'INT', 'LUK', 'MAX_HP', 'MAX_MP',
        'LEVEL_REDUCTION', 'DEF', 'ALL_STAT_PCT',
      ].includes(row.option)),
    },
    {
      label: item.config.equipment_type === 'weapon' ? 'Weapon-only flame stats' : 'Armor-only flame stats',
      rows: flameValues.filter(row => item.config.equipment_type === 'weapon'
        ? ['ATT', 'MATT', 'BOSS_DAMAGE_PCT', 'DAMAGE_PCT'].includes(row.option)
        : ['ATT', 'MATT', 'MOVE_SPEED', 'JUMP'].includes(row.option)),
    },
    {
      label: 'Combined flame stats',
      rows: flameValues.filter(row => combinedFlameOptions.includes(row.option)),
    },
  ].filter(group => group.rows.length)

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
          {optionsError ? <p className="error" role="alert">{optionsError}</p>
            : !availableOptions ? <p className="hint" role="status">Loading potential options…</p>
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
        </section>

        <section>
          <h4>Current flames</h4>
          {!supportsFlames ? <p className="hint">Flames are not supported for this slot.</p>
            : optionsError ? <p className="error" role="alert">{optionsError}</p>
              : !availableOptions ? <p className="hint" role="status">Loading flame options…</p>
                : (
                  <>
                    {item.needsFlameType && <label className="flame-checkbox">
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
                    <div className="flame-values-scroll">
                      <table className="flame-values-table">
                        <thead>
                          <tr>
                            <th scope="col">Flame option</th>
                            {availableOptions.flame_stages.map(stage => (
                              <th scope="col" key={stage}>Tier {stage}</th>
                            ))}
                          </tr>
                        </thead>
                        {flameGroups.map(group => (
                          <tbody key={group.label}>
                            <tr className="flame-values-group">
                              <th scope="colgroup" colSpan={availableOptions.flame_stages.length + 1}>
                                {group.label}
                              </th>
                            </tr>
                            {group.rows.map(row => (
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
                        ))}
                      </table>
                    </div>
                    <div className="current-flame-totals" aria-live="polite">
                      <h5>Combined selected flame stats</h5>
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
