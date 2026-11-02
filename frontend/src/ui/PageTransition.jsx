import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'

// Delay only presentation for the exit. Never key/unmount the retained page tree.
export default function PageTransition({ page, children }) {
  const [displayed, setDisplayed] = useState(page)
  const previous = useRef(page)
  const controls = useAnimationControls()
  const reduced = useReducedMotion()
  useEffect(() => {
    let cancelled = false
    let frame
    async function transition() {
      if (previous.current !== page && !reduced) await controls.start({ opacity: 0, transition: { duration: .1 } })
      if (cancelled) return
      previous.current = page
      controls.set({ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 })
      setDisplayed(page)
      frame = requestAnimationFrame(() => {
        if (!cancelled) controls.start({ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .25, ease: 'easeOut' } })
      })
    }
    void transition()
    return () => { cancelled = true; cancelAnimationFrame(frame); controls.stop() }
  }, [page, reduced, controls])
  return <motion.div className="mw-page-transition" initial={false} animate={controls} data-page={displayed || 'not-found'}>{children(displayed)}</motion.div>
}
