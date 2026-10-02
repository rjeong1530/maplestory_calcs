export const PAGE_PATHS = {
  potential: '/calculators/potential',
  flame: '/calculators/flames',
  starforce: '/calculators/starforce',
  equipment: '/equipment',
}

export function pageForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'potential'
  return Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === path) ?? null
}

export function isPlainNavigation(event) {
  return !event.defaultPrevented && event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
