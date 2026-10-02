import { Suspense, useState } from 'react'

// Load on first visit, then retain form state across navigation.
export default function DeferredPage({ active, children }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)

  if (!active && !visited) return null

  return <div hidden={!active}>
    <Suspense fallback={<p role="status">Loading calculator tools…</p>}>
      {children}
    </Suspense>
  </div>
}
