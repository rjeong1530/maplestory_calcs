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
    <nav className="main-navigation flex flex-wrap items-center gap-y-1 gap-x-4 mb-6 pb-4 border-b border-solid border-b-rule
        [&_>_a]:py-2 [&_>_a]:px-3 [&_>_a]:border [&_>_a]:border-solid [&_>_a]:border-transparent [&_>_a]:rounded-none
        [&_>_a]:bg-transparent [&_>_a]:text-[#d0cec3] [&_>_a]:text-[13px] [&_>_a]:cursor-pointer [&_a]:no-underline
        [&_[aria-current='page']]:text-maple [&_[aria-current='page']]:bg-transparent
        [&_[aria-current='page']]:[box-shadow:inset_0_-2px_var(--color-maple)] [&_a:hover]:bg-[#3c3a32]" aria-label="Main navigation">
      <a href={PAGE_PATHS.home} aria-current={activePage === 'home' ? 'page' : undefined}
        onClick={event => onNavigate('home', event)}>Home</a>
      <details className="calculator-dropdown relative [&_>_summary]:py-2 [&_>_summary]:px-3 [&_>_summary]:border
        [&_>_summary]:border-solid [&_>_summary]:border-transparent [&_>_summary]:rounded-none
        [&_>_summary]:bg-transparent [&_>_summary]:text-[#d0cec3] [&_>_summary]:text-[13px]
        [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary::-webkit-details-marker]:hidden
        [&_>_summary::after]:[content:'▾'] [&_>_summary::after]:ml-2 [&_>_summary:hover]:bg-[#302f29]
        [&_>_.navigation-active]:text-maple [&_>_.navigation-active]:bg-transparent
        [&_>_.navigation-active]:[box-shadow:inset_0_-2px_var(--color-maple)]" ref={dropdown}
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
        <div className="calculator-menu absolute top-[calc(100%_+_6px)] left-0 z-[10] grid min-w-40 p-1.25 border border-solid
        border-rule rounded-sm bg-surface [box-shadow:0_8px_24px_#0006] [&_a]:py-2.75 [&_a]:px-3.5 [&_a]:text-[13px]
        [&_a]:text-[#eeede6] [&_a]:text-left [&_a]:border-0 [&_a]:rounded-sm [&_a]:bg-transparent
        [&::before]:[content:''] [&::before]:absolute [&::before]:top-[-7px] [&::before]:left-0 [&::before]:right-0
        [&::before]:h-1.75">
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
      <a href={PAGE_PATHS.bugs} aria-current={activePage === 'bugs' ? 'page' : undefined}
        onClick={event => onNavigate('bugs', event)}>Report a bug</a>
    </nav>
  )
}
