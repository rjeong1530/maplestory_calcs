import LoadingStatus from './LoadingStatus'
import { LoadingButtonContent } from '../ui/loading'
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
    <form className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend className="flex items-center gap-3"><span className="font-mono text-xs text-maple" aria-hidden="true">01 /</span> Equipment &amp; cube</legend>
        <div className="equipment-grid grid grid-cols-[1.4fr_0.8fr_0.9fr] gap-3 [@media(max-width:480px)]:grid-cols-[1fr_1fr]
        [@media(max-width:480px)]:[&_label:first-child]:col-span-full">
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
            <span className="cube-price text-muted text-[12px] font-normal leading-[1.5]" aria-live="polite">{cubeCostLabel(cube, cubeSale)}</span>
          </label>
        </div>
        <label className="cube-sale-control flex-row items-center gap-2.5 my-5 mx-0 leading-[1.5] cursor-pointer [&_input]:shrink-0
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-maple [&_input]:m-0">
          <input type="checkbox" checked={cubeSale}
            onChange={event => { setCubeSale(event.target.checked); onChange() }} />
          <span>Cube sale (25% off black and red cubes)</span>
        </label>
        <div className="section-heading flex items-center justify-between gap-2 mt-7.5 [&_span]:text-[10px] [&_span]:text-maple
        [&_span]:tracking-[0] border-t border-rule pt-5"><h2 className="flex items-center gap-3"><span className="font-mono text-xs text-maple" aria-hidden="true">02 /</span> Potential targets</h2><span>All must match</span></div>
        <p className="hint text-[12px] text-muted mb-4.5">Minimum totals across three lines. All Stat counts toward each main stat.</p>
        {availableTargets.some(row => row.effect === 'ALL_STAT_PCT') && <p className="hint text-[12px] text-muted mb-4.5">
          All Stat adds its percentage to STR, DEX, INT, and LUK targets, including your main and secondary stats.
          These are combined stat totals; matching rolls do not need a specific All Stat line.
        </p>}
        {loadingOptions ? <LoadingStatus>Loading obtainable potential lines…</LoadingStatus>
          : currentOptions.error ? <div role="alert">
            <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]">{currentOptions.error}</p>
            <button type="button" onClick={() => {
              setItemOptions(null)
              setRetry(value => value + 1)
            }}>Retry loading lines</button>
          </div>
            : !currentOptions.potential.available && <p className="hint text-[12px] text-muted mb-4.5">
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
        <button type="button" className="secondary text-[12px] w-full bg-transparent" disabled={!canCalculate || availableTargets.length >= effects.length}
          onClick={() => {
            const effect = effects.find(value => !availableTargets.some(row => row.effect === value))
            setTargets(rows => [...rows, { id: nextId, effect, target: '1' }])
            setNextId(value => value + 1)
            onChange()
          }}>+ Add potential target</button>
        <button type="submit" className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91] mt-6" disabled={busy || !canCalculate}><LoadingButtonContent busy={busy}>Calculate probability →</LoadingButtonContent></button>
      </fieldset>
    </form>
  )
}
