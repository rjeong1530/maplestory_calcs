import { AnimatePresence, motion } from 'framer-motion'
import { EQUIPMENT_SLOTS, SLOT_LABELS } from '../data/flameEquipment'
import { useWorkshopMotion } from '../ui/motion'
import EquipmentIcon from './EquipmentIcon'
import { memo, useEffect, useId, useRef, useState } from 'react'


export default memo(function WorkshopEquipmentGrid({ equipment, activeSlot, onActivate, busy, href }) {
  const { reduced, transition } = useWorkshopMotion()
  const tooltipPrefix = useId()
  const [dismissedTooltip, setDismissedTooltip] = useState(null)
  const container = useRef(null)
  const [sceneryReady, setSceneryReady] = useState(() => typeof window === 'undefined' || !('IntersectionObserver' in window))
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setSceneryReady(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={container} className="equipment-avatar-window" data-scenery-ready={sceneryReady}>
    <div className="equipment-slots workshop-equipment-slots">
      {EQUIPMENT_SLOTS.map((slot, index) => {
        if (!slot) return <span key={`space-${index}`} aria-hidden="true" />
        const kind = slot.split('-')[0]
        const label = `${SLOT_LABELS[kind]}${slot.includes('-') ? ` ${slot.split('-')[1]}` : ''}`
        const item = equipment[slot]
        const SlotControl = href ? 'a' : 'button'
        if (slot === 'android') return <span className="equipment-slot equipment-slot-unavailable" key={slot} aria-label={`${label}: not selectable`}><span className="equipment-slot-name">{label}</span></span>
        return <div key={slot} className="equipment-slot-tooltip-wrap" data-tooltip-dismissed={dismissedTooltip === slot}
          onMouseEnter={() => setDismissedTooltip(null)} onFocus={() => setDismissedTooltip(null)}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissedTooltip(slot) } }}>
          <SlotControl type={href ? undefined : 'button'} href={href} className={`equipment-slot${item ? ' equipped' : ''}`} disabled={href ? undefined : busy}
            aria-pressed={href ? undefined : activeSlot === slot} aria-label={`${label}: ${item?.name || 'empty'}${href ? ', open Equipment Setup' : ''}`}
            aria-describedby={`${tooltipPrefix}-${slot}`}
            onClick={event => onActivate(slot, event)}
            style={{ '--item-accent': item?.color || 'var(--border)' }}>
            <AnimatePresence initial={false}>{item && <motion.span key={item.id} className="equipment-slot-item"
              initial={reduced ? false : { opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .95 }} transition={transition}>
              <EquipmentIcon item={item} /><small>{item.config.equipment_level}</small>
            </motion.span>}</AnimatePresence>
            <span className="equipment-slot-name">{label}</span>
          </SlotControl>
          <span id={`${tooltipPrefix}-${slot}`} className="equipment-slot-tooltip" role="tooltip">{item ? `${item.name} · Lv. ${item.config.equipment_level}` : `Choose ${label.toLowerCase()}`}</span>
        </div>
      })}
    </div>
  </div>
})
