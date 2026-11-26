import { Suspense, useState } from 'react'
import PageErrorBoundary from './PageErrorBoundary'
import { LoadingPlaceholder } from '../ui/loading'

// Load on first visit, then retain form state across navigation.
export default function DeferredPage({ active, children, loadingVariant = 'card' }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)

  if (!active && !visited) return null

  return <div hidden={!active}>
    <PageErrorBoundary>
      <Suspense fallback={<LoadingPlaceholder variant={loadingVariant} service={false} label="Loading calculator tools…" />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  </div>
}
