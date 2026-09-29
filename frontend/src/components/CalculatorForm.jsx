import { useState } from 'react'
import TargetRow from './TargetRow'

const percentiles = [50, 75, 90, 95, 99]
const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function CalculatorForm({ options, busy, onCalculate, onChange }) {
  const [equipment, setEquipment] = useState('hat')
  const [level, setLevel] = useState(250)
  const [cube, setCube] = useState('black')
  const [targets, setTargets] = useState([
    { id: 0, effect: 'STR_PCT', target: '13' },
    { id: 1, effect: 'COOLDOWN_SEC', target: '4' },
  ])
  const [nextId, setNextId] = useState(2)
  const [selectedPercentiles, setSelectedPercentiles] = useState(percentiles)

  function updateTarget(id, patch) {
    setTargets(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
    onChange()
  }

  function submit(event) {
    event.preventDefault()
    onCalculate({
      equipment_type: equipment, level: Number(level), cube_type: cube,
      targets: targets.map(({ effect, target }) => ({ effect, target: Number(target) })),
      percentiles: selectedPercentiles.map(value => value / 100),
    })
  }

  return (
    <form className="panel" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Build your roll</legend>
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
          </label>
        </div>
        <div className="section-heading"><h2>Potential targets</h2><span>ALL must match</span></div>
        <p className="hint">Minimum totals across three lines. All Stat counts toward each main stat.</p>
        <div className="target-list">
          {targets.map((row, index) => (
            <TargetRow key={row.id} row={row} index={index} effects={options.effects}
              usedEffects={targets.filter(item => item.id !== row.id).map(item => item.effect)}
              onUpdate={patch => updateTarget(row.id, patch)} canRemove={targets.length > 1}
              onRemove={() => { setTargets(rows => rows.filter(item => item.id !== row.id)); onChange() }} />
          ))}
        </div>
        <button type="button" className="secondary" disabled={targets.length >= options.effects.length}
          onClick={() => {
            const effect = options.effects.find(value => !targets.some(row => row.effect === value))
            setTargets(rows => [...rows, { id: nextId, effect, target: '1' }])
            setNextId(value => value + 1)
            onChange()
          }}>+ Add potential target</button>
        <h2 className="estimate-heading">Cube estimates</h2>
        <p className="hint">Choose the chances of success you want to reach.</p>
        <div className="percentiles">
          {percentiles.map(value => (
            <label key={value}>
              <input type="checkbox" checked={selectedPercentiles.includes(value)}
                onChange={event => {
                  setSelectedPercentiles(current => event.target.checked
                    ? [...current, value].sort((a, b) => a - b) : current.filter(item => item !== value))
                  onChange()
                }} />
              {value}%
            </label>
          ))}
        </div>
        <button type="submit" className="primary">{busy ? 'Calculating…' : 'Calculate probability →'}</button>
      </fieldset>
    </form>
  )
}

