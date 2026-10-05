export const PAGE_PATHS = {
  home: '/',
  potential: '/calculators/potential',
  flame: '/calculators/flames',
  starforce: '/calculators/starforce',
  equipment: '/equipment',
}

export function pageForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === path) ?? null
}

export function isPlainNavigation(event) {
  const link = event.currentTarget
  if (link?.hasAttribute?.('download') || (link?.target && link.target !== '_self')) return false
  return !event.defaultPrevented && event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

// Return the new path only when a history entry was actually added.
export function navigateToPage(page, event, browser = window) {
  const path = Object.hasOwn(PAGE_PATHS, page) ? PAGE_PATHS[page] : null
  if (!path || (event && !isPlainNavigation(event))) return null
  event?.preventDefault()
  if (pageForPath(browser.location.pathname) === page) return null
  browser.history.pushState(null, '', path)
  browser.scrollTo(0, 0)
  return path
}
