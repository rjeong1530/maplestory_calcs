import { LoadingSpinner, SkeletonCard } from './feedback'
import { cx } from './motion'
import './workshop.css'
import PageBackground from './PageBackground'

const coldStart = 'The calculator service may need to wake up after inactivity. The first request can take longer; please keep this page open.'

function SkeletonStatus({ label, children, className, service = false }) {
  return <div className={cx('mw-theme mw-loading-surface', className)} role="status" aria-busy="true">
    <p className="mw-loading-label"><span className="mw-spinner" aria-hidden="true" />{label}</p>
    <div aria-hidden="true">{children}</div>
    {service && <p className="mw-help mt-4">{coldStart}</p>}
  </div>
}

export function FullPageLoadingScreen({ label = 'Preparing your workshop...' }) {
  return <div className="mw-theme mw-fullpage-loading">
    <PageBackground />
    <div className="mw-loading-particles" aria-hidden="true">
      {['✦', '☁', '✧', '✦', '☁', '✧'].map((particle, index) => <span key={index} style={{ '--particle-index': index }}>{particle}</span>)}
    </div>
    <div className="mw-card mw-loading-welcome" role="status" aria-busy="true">
      <img src="/maplecalculator.png" width="80" height="80" alt="" />
      <h1 className="mw-heading mw-page-title">Maple Workshop</h1>
      <span className="mw-spinner" aria-hidden="true" />
      <p className="mw-muted mb-0">{label}</p>
    </div>
  </div>
}

export function SkeletonTable({ label = 'Loading table...', rows = 4, columns = 4, service = false }) {
  return <SkeletonStatus label={label} service={service}>
    <div className="mw-skeleton-table">{Array.from({ length: rows + 1 }, (_, row) => <div className="mw-skeleton-row" key={row}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, col) => <div className="mw-skeleton-line" key={col} />)}
    </div>)}</div>
  </SkeletonStatus>
}

export function EquipmentGridSkeleton({ label = 'Loading equipment...' }) {
  return <SkeletonStatus label={label}>
    <div className="mw-equipment-skeleton">{Array.from({ length: 30 }, (_, index) =>
      <div key={index} className={cx('mw-skeleton-line mw-skeleton-slot', [1, 3, 8, 25, 26].includes(index) && 'invisible')} />)}</div>
  </SkeletonStatus>
}

export function ResultSkeleton({ label = 'Calculating results...', service = true }) {
  return <SkeletonStatus label={label} service={service}>
    <div className="mw-result-skeleton"><div className="mw-skeleton-line w-1/3" />
      <div className="mw-skeleton-line mw-skeleton-metric" />
      <div className="mw-skeleton-line w-4/5" /><div className="mw-skeleton-line w-3/5" />
    </div>
  </SkeletonStatus>
}

// Callers own loading/result state. Children remain mounted and visible beneath
// the translucent layer; this component never resets a result or starts a timer.
export function CalculatorLoadingOverlay({ loading, children, label = 'Calculating results...', variant = 'result' }) {
  const skeleton = variant === 'equipment' ? <EquipmentGridSkeleton label={label} /> : <ResultSkeleton label={label} />
  if (children == null) return loading ? skeleton : null
  return <div className="mw-loading-region" aria-busy={loading}>
    {children}
    {loading && <div className="mw-calculator-loading-overlay">{skeleton}</div>}
  </div>
}

export function LoadingButtonContent({ busy, children, label = 'Calculating...' }) {
  return busy ? <LoadingSpinner label={label} /> : children
}

export function LoadingPlaceholder({ label = 'Loading calculator tools...', variant = 'card', service = true }) {
  if (variant === 'table') return <SkeletonTable label={label} service={service} />
  if (variant === 'equipment') return <EquipmentGridSkeleton label={label} />
  if (variant === 'result') return <CalculatorLoadingOverlay loading label={label} />
  return <div className="mw-theme mw-loading-surface">
    <LoadingSpinner label={label} />
    <div aria-hidden="true"><SkeletonCard decorative /></div>
    {service && <p className="mw-help mt-4">{coldStart}</p>}
  </div>
}
