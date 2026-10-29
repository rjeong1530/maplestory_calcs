import { useState } from 'react'
import { motion } from 'framer-motion'
import { ContentCard } from './layout'
import { cx, useWorkshopMotion } from './motion'

function ItemImage({ src, fallback = '◇' }) {
  const [failed, setFailed] = useState(null)
  return src && failed !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} /> : <span aria-hidden="true" className="text-2xl">{fallback}</span>
}

export function RarityBadge({ rarity, className, ...props }) {
  return <span {...props} data-rarity={rarity?.toLowerCase()} className={cx('mw-rarity', className)}>{rarity}</span>
}

export function EquipmentSlot({ label, image, rarity, selected = false, disabled, className, ...props }) {
  const { reduced, transition } = useWorkshopMotion()
  return <button {...props} type="button" disabled={disabled} aria-label={label} aria-pressed={selected}
    data-rarity={rarity?.toLowerCase()} className={cx('mw-slot', className)}><motion.span key={image || 'empty'} className="mw-slot-image"
      initial={reduced || !image ? false : {opacity:0,scale:.95}} animate={{opacity:1,scale:1}} transition={transition}><ItemImage src={image} /></motion.span></button>
}

export function ItemCard({ name, image, rarity, detail, children, className, ...props }) {
  return <ContentCard {...props} className={cx('mw-item', className)}>
    <div className="mw-slot" data-rarity={rarity?.toLowerCase()}><ItemImage src={image} /></div>
    <div className="min-w-0"><h3 className="mw-heading mw-section-title">{name}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">{rarity && <RarityBadge rarity={rarity} />}{detail && <span className="mw-muted text-xs">{detail}</span>}</div>{children}
    </div>
  </ContentCard>
}
