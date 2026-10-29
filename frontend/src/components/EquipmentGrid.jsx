import { useState } from 'react'
import { EQUIPMENT_SLOTS, SLOT_LABELS } from '../data/flameEquipment'
import WorkshopEquipmentGrid from './WorkshopEquipmentGrid'

export function EquipmentIcon({ item }) {
  const [failedUrls, setFailedUrls] = useState([])
  const url = item?.icon && !failedUrls.includes(item.icon) ? item.icon : null
  return url && (
    <img src={url} alt="" width="38" height="38" loading="lazy" decoding="async"
      onError={() => setFailedUrls(current => [...current, url])} />
  )
}

export default function EquipmentGrid({ equipment, activeSlot, onActivate, busy, workshop = false }) {
  if (workshop) return <WorkshopEquipmentGrid {...{ equipment, activeSlot, onActivate, busy }} />
  return (
    <div className="equipment-slots grid grid-cols-5 gap-1.5 max-w-66 m-auto [@media(max-width:480px)]:gap-1">
      {EQUIPMENT_SLOTS.map((slot, index) => {
        if (!slot) return <span key={`space-${index}`} aria-hidden="true" />
        const kind = slot.split('-')[0]
        const item = equipment[slot]
        const label = `${SLOT_LABELS[kind]}${slot.includes('-') ? ` ${slot.split('-')[1]}` : ''}`
        if (slot === 'android') {
          return <span key={slot} className="equipment-slot equipment-slot-unavailable min-w-0 aspect-square p-0.75 flex flex-col items-center
        justify-center gap-1 relative text-[#a0967c] bg-surface text-[9px] leading-[1.2] text-center opacity-50
        [&_img]:w-9.5 [&_img]:h-9.5 [&_img]:max-w-full [&_img]:max-h-full [&_img]:object-contain
        [&_img]:[image-rendering:pixelated] [&_>_span]:text-[9px] [&_>_span]:leading-[1.2] [&:disabled]:opacity-30
        [&.equipped]:bg-[#302f29] [&[aria-pressed='true']]:border-maple
        [&[aria-pressed='true']]:[box-shadow:0_0_0_1px_var(--color-maple)] [&_small]:absolute [&_small]:top-0.75
        [&_small]:right-0.75 [&_small]:text-[8px] [@media(max-width:480px)]:[&_>_span]:text-[8px]"
            aria-label={`${label}: not selectable`}>
            {label}
          </span>
        }
        return (
          <button type="button" key={slot} disabled={busy}
            className={`equipment-slot min-w-0 aspect-square p-0.75 flex flex-col items-center justify-center gap-1 relative bg-surface [&_img]:w-9.5 [&_img]:h-9.5 [&_img]:max-w-full [&_img]:max-h-full [&_img]:object-contain [&_img]:[image-rendering:pixelated] [&_>_span]:text-[9px] [&_>_span]:leading-[1.2] [&:disabled]:opacity-30 [&.equipped]:bg-[#302f29] [&[aria-pressed='true']]:border-maple [&[aria-pressed='true']]:[box-shadow:0_0_0_1px_var(--color-maple)] [&_small]:absolute [&_small]:top-0.75 [&_small]:right-0.75 [&_small]:text-[8px] [@media(max-width:480px)]:[&_>_span]:text-[8px]${item ? ` equipped ${item.color === '#f1cd78' ? 'text-[#f1cd78]' : 'text-[#a0e4b3]'}` : ' text-[#a0967c]'}`}
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
