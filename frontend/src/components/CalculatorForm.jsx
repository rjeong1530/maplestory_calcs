import LoadingStatus from './LoadingStatus'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { buildPotentialTargets } from '../data/potentialTargets'
import { cubeCostLabel } from '../data/cubeCosts'
import TargetRow from './TargetRow'

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function CalculatorForm({ options, busy, onCalculate, onChange }) {
  const [equipment, setEquipment] = useState('hat')
  const [level, setLevel] = useState(250)
  const [cube, setCube] = useState('black')
  const [cubeSale, setCubeSale] = useState(false)
  const [targets, setTargets] = useState([
    { id: 0, effect: 'STR_PCT', target: '13' },
    { id: 1, effect: 'COOLDOWN_SEC', target: '4' },
  ])
  const [nextId, setNextId] = useState(2)
  const [itemOptions, setItemOptions] = useState(null)
  const [retry, setRetry] = useState(0)
  const optionsKey = new URLSearchParams({
    potential_equipment_type: equipment, level: String(level), cube_type: cube,
  }).toString()
  const currentOptions = itemOptions?.key === optionsKey ? itemOptions : null
  const loadingOptions = !currentOptions
  const effects = (currentOptions?.potential?.effects ?? [])
    .filter(effect => effect === 'ALL_STAT_PCT' || options.effects.includes(effect))
  const availableTargets = targets.filter(row => effects.includes(row.effect))
  const canCalculate = currentOptions?.potential?.available && availableTargets.length > 0

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/api/item-options?${optionsKey}`, {
      signal: controller.signal,
    }).then(data => {
      if (controller.signal.aborted) return
      const allowedEffects = data.potential.effects
        .filter(effect => effect === 'ALL_STAT_PCT' || options.effects.includes(effect))
      setTargets(rows => {
        const validRows = rows.filter(row => allowedEffects.includes(row.effect))
        return validRows.length || !allowedEffects.length
          ? validRows : [{ id: 0, effect: allowedEffects[0], target: '1' }]
      })
      setItemOptions({ key: optionsKey, potential: data.potential })
    }).catch(error => {
      if (!controller.signal.aborted) setItemOptions({ key: optionsKey, error: error.message })
    })
    return () => controller.abort()
  }, [optionsKey, options.effects, retry])

  function updateTarget(id, patch) {
    setTargets(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
    onChange()
  }

  function submit(event) {
    event.preventDefault()
    if (!canCalculate || busy) return
    onCalculate({
      equipment_type: equipment, level: Number(level), cube_type: cube,
      cube_sale: cubeSale,
      targets: buildPotentialTargets(availableTargets),
      percentiles: [],
    })
  }

  return (
    <form className="panel" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend className="flex items-center gap-3"><span className="font-mono text-xs text-maple" aria-hidden="true">01 /</span> Equipment &amp; cube</legend>
        <div className="equipment-grid">
          <label>Equipment
            <select value={equipment} onChange={event => { setEquipment(event.target.value); onChange() }}>
              {options.equipment_types.map(value => <option key={value} value={value}>{title(value)}</option>)}
            </select>
          </label>
          <label>Item level
            <select value={level} onChange={event => { setLevel(event.target.value); onChange() }}>
              {options.levels.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Cube
            <select value={cube} onChange={event => { setCube(event.target.value); onChange() }}>
              {options.cube_types.map(value => <option key={value} value={value}>{title(value)}</option>)}
            </select>
            <span className="cube-price" aria-live="polite">{cubeCostLabel(cube, cubeSale)}</span>
          </label>
        </div>
        <label className="cube-sale-control">
          <input type="checkbox" checked={cubeSale}
            onChange={event => { setCubeSale(event.target.checked); onChange() }} />
          <span>Cube sale (25% off black and red cubes)</span>
        </label>
        <div className="section-heading border-t border-rule pt-5"><h2 className="flex items-center gap-3"><span className="font-mono text-xs text-maple" aria-hidden="true">02 /</span> Potential targets</h2><span>All must match</span></div>
        <p className="hint">Minimum totals across three lines. All Stat counts toward each main stat.</p>
        {availableTargets.some(row => row.effect === 'ALL_STAT_PCT') && <p className="hint">
          All Stat adds its percentage to STR, DEX, INT, and LUK targets, including your main and secondary stats.
          These are combined stat totals; matching rolls do not need a specific All Stat line.
        </p>}
        {loadingOptions ? <LoadingStatus>Loading obtainable potential lines…</LoadingStatus>
          : currentOptions.error ? <div role="alert">
            <p className="error">{currentOptions.error}</p>
            <button type="button" onClick={() => {
              setItemOptions(null)
              setRetry(value => value + 1)
            }}>Retry loading lines</button>
          </div>
            : !currentOptions.potential.available && <p className="hint">
              No potential table is available for this equipment, level, and cube.
            </p>}
        <div className="target-list grid gap-4 mb-4.5">
          {availableTargets.map((row, index) => (
            <TargetRow key={row.id} row={row} index={index} effects={effects}
              usedEffects={availableTargets.filter(item => item.id !== row.id).map(item => item.effect)}
              onUpdate={patch => updateTarget(row.id, patch)} canRemove={availableTargets.length > 1}
              onRemove={() => { setTargets(rows => rows.filter(item => item.id !== row.id)); onChange() }} />
          ))}
        </div>
        <button type="button" className="secondary" disabled={!canCalculate || availableTargets.length >= effects.length}
          onClick={() => {
            const effect = effects.find(value => !availableTargets.some(row => row.effect === value))
            setTargets(rows => [...rows, { id: nextId, effect, target: '1' }])
            setNextId(value => value + 1)
            onChange()
          }}>+ Add potential target</button>
        <button type="submit" className="primary mt-6" disabled={!canCalculate}>{busy ? 'Calculating…' : 'Calculate probability →'}</button>
      </fieldset>
    </form>
  )
}
