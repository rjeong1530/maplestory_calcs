import { useState } from 'react'
import { EQUIPMENT_SLOTS, SLOT_LABELS, equipmentChoices } from '../data/flameEquipment'
import EquipmentAnalysis from './EquipmentAnalysis'
import './EquipmentWindow.css'

function EquipmentIcon({ item }) {
  const [failedUrls, setFailedUrls] = useState([])
  const url = item?.icon && !failedUrls.includes(item.icon) ? item.icon : null
  return url && (
    <img src={url} alt="" width="38" height="38" loading="lazy" decoding="async"
      onError={() => setFailedUrls(current => [...current, url])} />
  )
}

export default function EquipmentWindow({
  equipmentClass, mapleClasses, onMapleClassChange, equipment, activeSlot,
  onActivate, onSelect, onRemove, busy, classStats, onUpdateEquipmentRoll,
}) {
  const [pickerSlot, setPickerSlot] = useState(null)
  const type = pickerSlot?.split('-')[0]
  const choices = pickerSlot ? equipmentChoices(pickerSlot, equipmentClass) : []
  const selected = equipment[activeSlot]

  return (
    <section className="panel equipment-window" aria-label="Equipment selector">
      <div className="equipment-window-heading">
        <div>
          <h2>Equipment</h2><span className="eyebrow">SELECT A SLOT</span>
        </div>
      </div>
      <label className="equipment-class-selector">Equipment class
        <select value={equipmentClass} onChange={event => onMapleClassChange(event.target.value)}>
          {mapleClasses.map(mapleClass => (
            <option key={mapleClass} value={mapleClass}>{mapleClass}</option>
          ))}
        </select>
      </label>
      <div className="equipment-slots">
        {EQUIPMENT_SLOTS.map((slot, index) => {
          if (!slot) return <span key={`space-${index}`} aria-hidden="true" />
          const kind = slot.split('-')[0]
          const item = equipment[slot]
          const label = `${SLOT_LABELS[kind]}${slot.includes('-') ? ` ${slot.split('-')[1]}` : ''}`
          if (slot === 'android') {
            return <span key={slot} className="equipment-slot equipment-slot-unavailable"
              aria-label={`${label}: not selectable`}>
              {label}
            </span>
          }
          return (
            <button type="button" key={slot} disabled={busy}
              className={`equipment-slot${item ? ' equipped' : ''}`}
              style={item ? { '--item-color': item.color } : undefined}
              aria-pressed={(pickerSlot ?? activeSlot) === slot}
              aria-label={`${label}: ${item?.name || 'empty'}`}
              title={item?.name || `Choose ${label.toLowerCase()}`}
              onClick={() => {
                setPickerSlot(slot)
                onActivate(slot)
                if (item) onSelect(slot, item)
              }}>
              {item && <EquipmentIcon key={item.id} item={item} />}
              {item && <small>{item.config.equipment_level}</small>}
              {!item && <span>{label}</span>}
            </button>
          )
        })}
      </div>
      <p className="equipment-summary" aria-live="polite">
        {selected ? <><strong>{selected.name}</strong><br />Level {selected.config.equipment_level}
          {` · ${selected.currentStarForce ?? 0}★ Star Force`}
          {selected.needsFlameType ? ' · Check the Boss equipment setting below for this accessory.'
            : ` · ${selected.config.boss_equipment ? 'Boss' : 'Normal'} flames`}</>
          : activeSlot
            ? `${SLOT_LABELS[activeSlot.split('-')[0]]} selected · No equipment selected.`
            : 'Select a slot to choose equipment.'}
      </p>
      {selected && activeSlot && (
        <div className="equipped-item-analyses">
          <h3>{SLOT_LABELS[activeSlot.split('-')[0]]}
            {activeSlot.includes('-') ? ` ${activeSlot.split('-')[1]}` : ''} — {selected.name}
          </h3>
          <p className="hint">Record this item's current potential and flames. Options match its level and type.</p>
          <EquipmentAnalysis key={`${activeSlot}-${selected.id}`} slot={activeSlot} item={selected}
            offenseStat={classStats.offense}
            onChange={updates => onUpdateEquipmentRoll(activeSlot, updates)} />
        </div>
      )}
      {pickerSlot && (
        <div className="equipment-picker">
          <div className="equipment-window-heading">
            <h3>Choose {SLOT_LABELS[type].toLowerCase()}</h3>
            <button type="button" onClick={() => setPickerSlot(null)}
              aria-label="Close equipment picker">Close</button>
          </div>
          <label className="equipment-dropdown">Equipment for {equipmentClass}
            <select disabled={busy || !choices.length}
              value={choices.some(item => item.id === equipment[pickerSlot]?.id)
                ? equipment[pickerSlot].id : ''}
              onChange={event => {
                const item = choices.find(choice => choice.id === Number(event.target.value))
                if (item) onSelect(pickerSlot, item)
              }}>
              <option value="" disabled>Choose equipment…</option>
              {choices.map(item => <option key={item.id} value={item.id}>
                {item.name} — Lv. {item.config.equipment_level}
              </option>)}
            </select>
          </label>
          {!choices.length && <p className="hint">
            No matching equipment for this slot and class in the catalog.
          </p>}
          {equipment[pickerSlot] && <button type="button" className="secondary" onClick={() => {
            onRemove(pickerSlot); setPickerSlot(null)
          }}>Remove equipment</button>}
        </div>
      )}
    </section>
  )
}
