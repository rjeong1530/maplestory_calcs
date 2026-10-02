import { useEffect, useRef } from 'react'
import { PAGE_PATHS, isPlainNavigation } from '../data/routes'

const calculators = [
  ['potential', 'Potential'],
  ['flame', 'Flames'],
  ['starforce', 'Star Force'],
]

export default function Navigation({ activePage, onNavigate }) {
  const dropdown = useRef(null)

  useEffect(() => {
    function closeOutside(event) {
      if (!dropdown.current?.contains(event.target)) dropdown.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <nav className="main-navigation" aria-label="Main navigation">
      <details className="calculator-dropdown" ref={dropdown}
        onPointerEnter={event => {
          if (event.pointerType === 'mouse') event.currentTarget.setAttribute('open', '')
        }}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse') event.currentTarget.removeAttribute('open')
        }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open')
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            dropdown.current.removeAttribute('open')
            dropdown.current.querySelector('summary').focus()
          }
        }}>
        <summary className={calculators.some(([page]) => page === activePage) ? 'navigation-active' : undefined}>Calculator</summary>
        <div className="calculator-menu">
          {calculators.map(([page, label]) => (
            <a key={page} href={PAGE_PATHS[page]} aria-current={activePage === page ? 'page' : undefined}
              onClick={event => {
                if (!isPlainNavigation(event)) return
                onNavigate(page, event)
                dropdown.current.removeAttribute('open')
                dropdown.current.querySelector('summary').focus()
              }}>{label}</a>
          ))}
        </div>
      </details>
      <a href={PAGE_PATHS.equipment} aria-current={activePage === 'equipment' ? 'page' : undefined}
        onClick={event => onNavigate('equipment', event)}>Equipment upgrade</a>
    </nav>
  )
}
