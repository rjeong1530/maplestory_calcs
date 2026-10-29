import { AnimatePresence, motion } from 'framer-motion'
import { EQUIPMENT_SLOTS, SLOT_LABELS } from '../data/flameEquipment'
import { useWorkshopMotion } from '../ui/motion'
import { EquipmentIcon } from './EquipmentGrid'

const symbols = { ring: '○', hat: '♧', emblem: '✦', pendant: '♧', face: '◡', badge: '✧', eye: '∞', earring: '♢', medal: '✵', weapon: '⚔', top: '♜', shoulder: '◒', secondary: '◇', pocket: '▣', belt: '═', bottom: 'Π', gloves: '♧', cape: '△', shoes: '⌁', android: '♙', heart: '♡' }

export default function WorkshopEquipmentGrid({ equipment, activeSlot, onActivate, busy }) {
  const { reduced, transition } = useWorkshopMotion()
  return <div className="equipment-avatar-window">
    <div className="equipment-slots workshop-equipment-slots">
      {EQUIPMENT_SLOTS.map((slot, index) => {
        if (!slot) return <span key={`space-${index}`} aria-hidden="true" />
        const kind = slot.split('-')[0]
        const label = `${SLOT_LABELS[kind]}${slot.includes('-') ? ` ${slot.split('-')[1]}` : ''}`
        const item = equipment[slot]
        if (slot === 'android') return <span className="equipment-slot equipment-slot-unavailable" key={slot} aria-label={`${label}: not selectable`}><span aria-hidden="true">{symbols[kind]}</span><small>{label}</small></span>
        return <div key={slot} className="equipment-slot-tooltip-wrap">
          <button type="button" className={`equipment-slot${item ? ' equipped' : ''}`} disabled={busy}
            aria-pressed={activeSlot === slot} aria-label={`${label}: ${item?.name || 'empty'}`}
            title={item?.name || `Choose ${label.toLowerCase()}`} onClick={() => onActivate(slot)}
            style={{ '--item-accent': item?.color || 'var(--border)' }}>
            <span className="equipment-empty-icon" aria-hidden="true">{symbols[kind] || '◇'}</span>
            <AnimatePresence initial={false}>{item && <motion.span key={item.id} className="equipment-slot-item"
              initial={reduced ? false : { opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .95 }} transition={transition}>
              <EquipmentIcon item={item} /><small>{item.config.equipment_level}</small>
            </motion.span>}</AnimatePresence>
            <span className="equipment-slot-name">{label}</span>
          </button>
          <span className="equipment-slot-tooltip" role="tooltip">{item ? `${item.name} · Lv. ${item.config.equipment_level}` : `Choose ${label.toLowerCase()}`}</span>
        </div>
      })}
    </div>
  </div>
}
