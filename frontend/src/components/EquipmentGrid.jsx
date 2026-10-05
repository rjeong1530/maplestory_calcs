import { useState } from 'react'
import { EQUIPMENT_SLOTS, SLOT_LABELS } from '../data/flameEquipment'

export function EquipmentIcon({ item }) {
  const [failedUrls, setFailedUrls] = useState([])
  const url = item?.icon && !failedUrls.includes(item.icon) ? item.icon : null
  return url && (
    <img src={url} alt="" width="38" height="38" loading="lazy" decoding="async"
      onError={() => setFailedUrls(current => [...current, url])} />
  )
}

export default function EquipmentGrid({ equipment, activeSlot, onActivate, busy }) {
  return (
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
            aria-pressed={activeSlot === slot}
            aria-label={`${label}: ${item?.name || 'empty'}`}
            title={item?.name || `Choose ${label.toLowerCase()}`}
            onClick={() => {
              onActivate(slot)
            }}>
            {item && <EquipmentIcon key={item.id} item={item} />}
            {item && <small>{item.config.equipment_level}</small>}
            {!item && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
