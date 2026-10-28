import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

// Only the aria-hidden display interpolates. The accessible value and all caller
// calculations use the exact result immediately. Undefined clears presentation,
// retaining only the last displayed number for the next short transition.
export default function AnimatedNumber({ value, format }) {
  const element = useRef(null)
  const previous = useRef(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!Number.isFinite(value)) return
    const start = previous.current ?? value
    previous.current = value
    if (reduced || start === value) {
      if (element.current) element.current.textContent = format(value)
      return
    }
    const animation = animate(start, value, {
      duration: .25, ease: 'easeOut',
      onUpdate: latest => { if (element.current) element.current.textContent = format(latest) },
      onComplete: () => { if (element.current) element.current.textContent = format(value) },
    })
    return () => animation.stop()
  }, [value, format, reduced])
  if (!Number.isFinite(value)) return null
  return <><span className="sr-only">{format(value)}</span><span ref={element} aria-hidden="true">{format(value)}</span></>
}
