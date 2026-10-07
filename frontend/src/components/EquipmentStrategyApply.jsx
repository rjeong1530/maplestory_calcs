import { useState } from 'react'
import { EQUIPMENT_GROUPS, equipmentGroup, canApplyStrategy } from '../data/equipmentGroups'
import { SLOT_LABELS } from '../data/flameEquipment'
import './EquipmentStrategyApply.css'

export default function EquipmentStrategyApply({ equipment, strategy, onApply }) {
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState('')
  const entries = Object.entries(equipment).filter(([slot, item]) => canApplyStrategy(item, slot))
  const targets = entries.filter(([slot, item]) => scope === 'all'
    || (scope === 'selected' ? selected.includes(slot) : equipmentGroup(item, slot) === scope))

  return <details className="equipment-strategy-apply">
    <summary>Apply approach to equipment</summary>
    {strategy.name && <p>Source: <strong>{strategy.name}</strong></p>}
    <p className="hint">Copy these per-star modes and safeguards to your saved equipment. Current stars, stats,
      replacement costs, and upgrade limits stay as recorded. Upgrade costs are recalculated for each item
      using the event and MVP settings in Equipment.</p>
    <div className="equipment-apply-scopes" role="group" aria-label="Equipment to apply to">
      {Object.entries({ all: 'All eligible', ...Object.fromEntries(Object.entries(EQUIPMENT_GROUPS).filter(([key]) => key !== 'other')), selected: 'Select equipment' })
        .map(([key, label]) => <button type="button" key={key} aria-pressed={scope === key}
          onClick={() => { setScope(key); setMessage('') }}>{label}</button>)}
    </div>
    <div className="equipment-apply-items">
      {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => {
        const items = (scope === 'selected' ? entries : targets).filter(([slot, item]) => equipmentGroup(item, slot) === group)
        return items.length > 0 && <fieldset key={group}>
          <legend>{label}</legend>
          {items.map(([slot, item]) => <label key={slot}>
            {scope === 'selected' && <input type="checkbox" checked={selected.includes(slot)}
              onChange={event => { setSelected(current => event.target.checked ? [...current, slot] : current.filter(key => key !== slot)); setMessage('') }} />}
            <span>{item.name} <small>({SLOT_LABELS[slot.split('-')[0]]}{slot.includes('-') ? ` ${slot.split('-')[1]}` : ''})</small></span>
          </label>)}
        </fieldset>
      })}
    </div>
    {!targets.length && <p className="hint">{entries.length ? 'No eligible equipment selected in this group.' : 'Equip items with enhancement modes in Equipment setup first.'}</p>}
    <button type="button" disabled={!targets.length} onClick={() => {
      onApply(targets.map(([slot]) => slot), strategy)
      setMessage(`Approach applied to ${targets.length} equipment item(s).`)
    }}>Apply to {targets.length} item(s)</button>
    <p role="status">{message}</p>
  </details>
}
