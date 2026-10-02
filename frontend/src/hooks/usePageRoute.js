import { useEffect, useState } from 'react'
import { PAGE_PATHS, pageForPath, isPlainNavigation } from '../data/routes'

export default function usePageRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  function navigate(page, event) {
    if (event && !isPlainNavigation(event)) return
    event?.preventDefault()
    const path = PAGE_PATHS[page]
    if (!path || path === window.location.pathname) return
    window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo(0, 0)
  }

  return [pageForPath(pathname), navigate]
}
