import { useEffect, useId, useRef, useState } from 'react'
import { isPlainNavigation } from '../data/routes'
import { cx } from './motion'

export function Navbar({ brand = 'Maple Workshop', brandHref = '/', onBrandClick, icon, links = [], actions, className, ...props }) {
  const id = useId()
  const nav = useRef(null)
  const toggle = useRef(null)
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches)
  const [open, setOpen] = useState(false)
  function closeDropdowns() { nav.current?.querySelectorAll('details[open]').forEach(details => details.removeAttribute('open')) }
  useEffect(() => {
    const query = window.matchMedia('(max-width: 899px)')
    const resize = () => { setMobile(query.matches); setOpen(false); closeDropdowns() }
    const outside = event => { if (!nav.current?.contains(event.target)) { setOpen(false); closeDropdowns() } }
    query.addEventListener('change', resize)
    document.addEventListener('pointerdown', outside)
    return () => { query.removeEventListener('change', resize); document.removeEventListener('pointerdown', outside) }
  }, [])
  function linkClick(event, handler) {
    const plain = isPlainNavigation(event)
    handler?.(event)
    if (!plain) return
    const details = event.currentTarget.closest('details')
    closeDropdowns()
    setOpen(false)
    if (mobile) toggle.current?.focus()
    else details?.querySelector('summary')?.focus()
  }
  function renderLink({ label, active, ...link }) {
    return <a {...link} key={link.href} className={cx('mw-navlink', link.className)} aria-current={active ? 'page' : undefined}
      onClick={event => linkClick(event, link.onClick)}>{label}</a>
  }
  return <nav {...props} ref={nav} aria-label={props['aria-label'] || 'Main navigation'} className={cx('mw-navbar main-navigation', className)}
    onKeyDown={event => {
      if (event.key !== 'Escape') return
      const details = event.target.closest('details[open]')
      if (details) { event.preventDefault(); details.removeAttribute('open'); details.querySelector('summary').focus() }
      else if (mobile && open) { event.preventDefault(); setOpen(false); toggle.current?.focus() }
    }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { closeDropdowns(); setOpen(false) } }}>
    <div className="mw-navbar-inner">
      <a href={brandHref} onClick={event => linkClick(event, onBrandClick)} className="mw-brand">
        {icon || <img src="/maplecalculator48.png" width="36" height="36" alt="" />}<span>{brand}</span>
      </a>
      <button ref={toggle} type="button" className="mw-menu-toggle mw-button mw-button-secondary" aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg><span>Menu</span>
      </button>
      <div id={id} className="mw-navigation-panel" hidden={mobile && !open}>
        <div className="mw-navlinks">{links.map(link => link.children ? <details className="mw-dropdown calculator-dropdown" key={link.label}
          onPointerEnter={event => { if (!mobile && event.pointerType === 'mouse') event.currentTarget.setAttribute('open', '') }}
          onPointerLeave={event => { if (!mobile && event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) event.currentTarget.removeAttribute('open') }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open') }}>
          <summary className={cx('mw-navlink', link.children.some(child => child.active) && 'mw-navigation-active')}>{link.label}<span aria-hidden="true">▾</span></summary>
          <div className="mw-dropdown-links calculator-menu">{link.children.map(renderLink)}</div>
        </details> : renderLink(link))}</div>
        {actions && <div className="mw-navigation-actions">{actions}</div>}
      </div>
    </div>
  </nav>
}
