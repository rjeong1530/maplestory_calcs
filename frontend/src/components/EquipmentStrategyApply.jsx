import { useState } from 'react'
import { EQUIPMENT_GROUPS, equipmentGroup, canApplyStrategy } from '../data/equipmentGroups'
import { SLOT_LABELS } from '../data/flameEquipment'

export default function EquipmentStrategyApply({ equipment, strategy, onApply }) {
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState('')
  const entries = Object.entries(equipment).filter(([slot, item]) => canApplyStrategy(item, slot))
  const targets = entries.filter(([slot, item]) => scope === 'all'
    || (scope === 'selected' ? selected.includes(slot) : equipmentGroup(item, slot) === scope))

  return <details className="equipment-strategy-apply my-5 mx-0 p-4 border border-solid border-rule rounded-sm group">
    <summary className="cursor-pointer p-0 text-[13px] font-semibold group-open:mb-3">Apply approach to equipment</summary>
    {strategy.name && <p>Source: <strong>{strategy.name}</strong></p>}
    <p className="hint text-[12px] text-muted mb-4.5">Copy these per-star modes and safeguards to your saved equipment. Current stars, stats,
      replacement costs, and upgrade limits stay as recorded. Upgrade costs are recalculated for each item
      using the event and MVP settings in Equipment.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment to apply to">
      {Object.entries({ all: 'All eligible', ...Object.fromEntries(Object.entries(EQUIPMENT_GROUPS).filter(([key]) => key !== 'other')), selected: 'Select equipment' })
        .map(([key, label]) => <button className="px-2.5 py-2 text-[12px] aria-pressed:border-maple aria-pressed:text-maple" type="button" key={key} aria-pressed={scope === key}
          onClick={() => { setScope(key); setMessage('') }}>{label}</button>)}
    </div>
    <div className="equipment-apply-items my-4 grid gap-3">
      {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => {
        const items = (scope === 'selected' ? entries : targets).filter(([slot, item]) => equipmentGroup(item, slot) === group)
        return items.length > 0 && <fieldset key={group}>
          <legend className="mb-2 text-[13px]">{label}</legend>
          {items.map(([slot, item]) => <label className="my-1.5 flex-row items-center gap-2" key={slot}>
            {scope === 'selected' && <input className="w-auto" type="checkbox" checked={selected.includes(slot)}
              onChange={event => { setSelected(current => event.target.checked ? [...current, slot] : current.filter(key => key !== slot)); setMessage('') }} />}
            <span>{item.name} <small className="text-muted">({SLOT_LABELS[slot.split('-')[0]]}{slot.includes('-') ? ` ${slot.split('-')[1]}` : ''})</small></span>
          </label>)}
        </fieldset>
      })}
    </div>
    {!targets.length && <p className="hint text-[12px] text-muted mb-4.5">{entries.length ? 'No eligible equipment selected in this group.' : 'Equip items with enhancement modes in Equipment setup first.'}</p>}
    <button type="button" disabled={!targets.length} onClick={() => {
      onApply(targets.map(([slot]) => slot), strategy)
      setMessage(`Approach applied to ${targets.length} equipment item(s).`)
    }}>Apply to {targets.length} item(s)</button>
    <p className="empty:hidden" role="status">{message}</p>
  </details>
}
