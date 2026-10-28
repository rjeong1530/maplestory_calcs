import { Suspense, useState } from 'react'
import PageErrorBoundary from './PageErrorBoundary'
import LoadingStatus from './LoadingStatus'

// Load on first visit, then retain form state across navigation.
export default function DeferredPage({ active, children, loadingVariant = 'card' }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)

  if (!active && !visited) return null

  return <div hidden={!active}>
    <PageErrorBoundary>
      <Suspense fallback={<LoadingStatus variant={loadingVariant} service={false} />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  </div>
}
