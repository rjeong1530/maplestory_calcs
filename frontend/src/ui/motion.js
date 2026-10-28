import { useReducedMotion } from 'framer-motion'

export function useWorkshopMotion() {
  const reduced = useReducedMotion()
  return {
    reduced,
    transition: { duration: reduced ? 0 : .18, ease: 'easeOut' },
    entrance: { initial: reduced ? false : { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } },
    press: reduced ? undefined : { scale: .98 },
  }
}

export const cx = (...values) => values.filter(Boolean).join(' ')
