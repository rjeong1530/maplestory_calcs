import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ContentCard, SectionHeader } from './layout'
import { SecondaryButton } from './controls'
import { cx, useWorkshopMotion } from './motion'

export function LoadingSpinner({ label = 'Loading…', className, ...props }) {
  return <span {...props} className={cx('inline-flex items-center gap-2', className)} role="status">
    <span className="mw-spinner" aria-hidden="true" /><span>{label}</span>
  </span>
}

export function SkeletonCard({ label = 'Loading content…', className, decorative = false, ...props }) {
  return <ContentCard {...props} className={cx('mw-theme space-y-4', className)} role={decorative ? undefined : 'status'} aria-busy={decorative ? undefined : true}>
    {!decorative && <span className="sr-only">{label}</span>}<div aria-hidden="true" className="space-y-4">
      <div className="mw-skeleton-line w-1/3" /><div className="mw-skeleton-line w-full" />
      <div className="mw-skeleton-line w-4/5" /><div className="mw-skeleton-line w-1/2" />
    </div>
  </ContentCard>
}

export function EmptyState({ title = 'Ready when you are', description, icon = '✦', action, className, ...props }) {
  return <div {...props} className={cx('py-8 text-center', className)}>
    <div className="mw-muted mb-3 text-4xl" aria-hidden="true">{icon}</div>
    <h3 className="mw-heading mw-section-title">{title}</h3>
    {description && <p className="mw-muted mt-2 mb-5">{description}</p>}{action}
  </div>
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again', className, ...props }) {
  return <ContentCard {...props} role="alert" className={cx('mw-error', className)}>
    <SectionHeader title={title} /><p className="mw-field-error mb-4 wrap-anywhere">{message}</p>
    {onRetry && <SecondaryButton onClick={onRetry}>{retryLabel}</SecondaryButton>}
  </ContentCard>
}

export function Tooltip({ content, children, className }) {
  const id = useId()
  const trigger = useRef(null)
  const popup = useRef(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const { transition } = useWorkshopMotion()
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      if (!trigger.current || !popup.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const box = popup.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(anchor.left + (anchor.width - box.width) / 2, window.innerWidth - box.width - 8))
      const above = anchor.top - box.height - 8
      setPosition({ left, top: above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - box.height - 8) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, content])
  return <span ref={trigger} className={cx('relative inline-flex', className)} tabIndex={0} aria-describedby={open ? id : undefined}
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}>
    {children}<AnimatePresence>{open && <motion.span ref={popup} id={id} role="tooltip" className="mw-tooltip" style={position}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>{content}</motion.span>}</AnimatePresence>
  </span>
}

// Native dialog provides focus containment, Escape behavior, background inertness
// and focus restoration. Keep this component mounted and control `open`.
export function Modal({ open, onClose, title, description, children, actions, className }) {
  const ref = useRef(null)
  const id = useId()
  const { reduced, transition } = useWorkshopMotion()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && reduced && dialog.open) dialog.close()
  }, [open, reduced])
  return <motion.dialog ref={ref} className={cx('mw-dialog', className)} aria-labelledby={`${id}-title`}
    data-open={open}
    aria-describedby={description ? `${id}-description` : undefined}
    initial={false} animate={{ opacity: open ? 1 : 0, scale: reduced || open ? 1 : .97 }} transition={transition}
    onAnimationComplete={() => { if (!open && ref.current?.open) ref.current.close() }}
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length)
      const first = controls[0]
      const last = controls.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}>
    <div className="p-6">
      <SectionHeader id={`${id}-title`} title={title} action={<SecondaryButton aria-label="Close dialog" onClick={onClose}>×</SecondaryButton>} />
      {description && <p className="mw-muted mb-5" id={`${id}-description`}>{description}</p>}
      {children}{actions && <div className="mw-actions mt-6 flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  </motion.dialog>
}

export function Toast({ open, onDismiss, children, tone = 'success' }) {
  const { reduced, transition } = useWorkshopMotion()
  return <AnimatePresence>{open && <motion.div initial={reduced ? false : {opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{ opacity: 0 }} transition={transition}
    className={cx('mw-card mw-toast', tone === 'error' && 'mw-error')}>
    <div className="min-w-0 flex-1" role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
    <SecondaryButton onClick={onDismiss} aria-label="Dismiss notification">×</SecondaryButton>
  </motion.div>}</AnimatePresence>
}
