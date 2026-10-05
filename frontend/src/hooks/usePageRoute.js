import { useEffect, useState } from 'react'
import { pageForPath, navigateToPage } from '../data/routes'

export default function usePageRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  function navigate(page, event) {
    const path = navigateToPage(page, event)
    if (path) setPathname(path)
  }

  return [pageForPath(pathname), navigate]
}
