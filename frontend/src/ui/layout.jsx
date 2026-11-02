import { useId } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { cx, useWorkshopMotion } from './motion'
import PageBackground from './PageBackground'
export { Navbar } from './navigation'

export function AppShell({ children, navbar, backgroundImage = '/images/workshop/floating-islands.webp', className, style, ...props }) {
  const id = useId()
  return <MotionConfig reducedMotion="user">
    <div {...props} className={cx('mw-theme mw-shell', className)} style={{ '--workshop-background': backgroundImage ? `url("${backgroundImage}")` : 'none', ...style }}>
      <PageBackground backgroundImage={backgroundImage} />
      <a className="mw-skip" href={`#${id}`}>Skip to content</a>
      {navbar}
      <main id={id} tabIndex={-1} className="mw-content">{children}</main>
    </div>
  </MotionConfig>
}

export function PageHeader({ title, description, icon, actions, eyebrow, className, ...props }) {
  return <header {...props} className={cx('mb-6 flex flex-wrap items-center justify-between gap-4', className)}>
    <div className="flex min-w-0 items-center gap-3">
      {icon && <span aria-hidden="true" className="text-4xl">{icon}</span>}
      <div>{eyebrow && <p className="mw-muted mb-1 text-xs font-bold uppercase tracking-widest">{eyebrow}</p>}
        <h1 className="mw-heading mw-page-title">{title}</h1>
        {description && <p className="mt-2 mb-0 text-sm">{description}</p>}</div>
    </div>
    {actions && <div className="mw-actions flex flex-wrap gap-2">{actions}</div>}
  </header>
}

export function SectionHeader({ title, description, action, className, ...props }) {
  return <div className={cx('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
    <div><h2 {...props} className="mw-heading mw-section-title">{title}</h2>
      {description && <p className="mw-muted mt-2 mb-0 text-sm">{description}</p>}</div>{action}
  </div>
}

export function ContentCard({ children, className, hover = false, ...props }) {
  const { entrance, transition, reduced } = useWorkshopMotion()
  return <motion.section {...entrance} transition={transition} whileHover={hover && !reduced ? { y: -2 } : undefined}
    {...props} className={cx('mw-card', hover && 'mw-card-hover', className)}>{children}</motion.section>
}

export function CalculatorPanel({ title, description, children, ...props }) {
  const id = useId()
  return <ContentCard aria-labelledby={title ? id : undefined} {...props}>
    {title && <SectionHeader id={id} title={title} description={description} />}{children}
  </ContentCard>
}

export function ResultCard({ title = 'Results', busy = false, children, className, ...props }) {
  return <CalculatorPanel title={title} aria-live="polite" aria-busy={busy} {...props} className={cx('mw-result', className)}>{children}</CalculatorPanel>
}

// Animate the displayed value only, never a calculator's stateful subtree or value.
export function StatCard({ label, value, unit, hint, className, ...props }) {
  const { entrance, transition } = useWorkshopMotion()
  return <div {...props} className={cx('mw-stat', className)}>
    <div className="mw-muted mb-2 text-xs">{label}</div>
    <div className="mw-stat-value"><motion.span key={String(value)} {...entrance} transition={transition} className="inline-block">{value}</motion.span>{unit && <span className="ml-1 text-xs font-medium">{unit}</span>}</div>
    {hint && <p className="mw-help mt-2">{hint}</p>}
  </div>
}

export function CalculatorGrid({ children, columns = 2, className, ...props }) {
  return <div {...props} className={cx('grid grid-cols-1 items-start gap-5 md:grid-cols-2', columns === 3 && 'xl:grid-cols-3', className)}>{children}</div>
}
