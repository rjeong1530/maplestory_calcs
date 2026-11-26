import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import { ThemeContext } from './useTheme'
import './theme.css'

let media
const systemMedia = () => media ??= window.__workshopThemeMedia ?? window.matchMedia('(prefers-color-scheme: dark)')
const getSnapshot = () => systemMedia().matches ? 'dark' : 'light'
function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
function subscribe(callback) {
  const query = systemMedia()
  const change = () => { applyTheme(getSnapshot()); callback() }
  query.addEventListener('change', change)
  return () => query.removeEventListener('change', change)
}

export function ThemeProvider({ children }) {
  const systemTheme = useSyncExternalStore(subscribe, getSnapshot, () => 'light')
  useLayoutEffect(() => { applyTheme(systemTheme) }, [systemTheme])
  const value = useMemo(() => ({ theme: systemTheme, systemTheme, isDarkMode: systemTheme === 'dark', preference: 'system' }), [systemTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

