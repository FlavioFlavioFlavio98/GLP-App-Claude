import { useEffect, useRef, useState } from 'react'

/**
 * Animates a numeric value from its previous state to the new one.
 * Returns { displayVal, animClass } — animClass is 'count-up' | 'count-down' | ''.
 * No animation on first render (prevRef starts null).
 */
export function useCountUp(value, duration = 600) {
  const [displayVal, setDisplayVal] = useState(value)
  const [animClass, setAnimClass] = useState('')
  const prevRef = useRef(null) // null = first render flag
  const rafRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    // First render: skip animation, just record the value
    if (prevRef.current === null) {
      prevRef.current = value
      setDisplayVal(value)
      return
    }

    const from = prevRef.current
    const to = value
    prevRef.current = value

    if (from === to) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)

    setAnimClass(to > from ? 'count-up' : 'count-down')
    const startTime = performance.now()

    function step(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - (1 - progress) ** 3
      setDisplayVal(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setDisplayVal(to)
        timerRef.current = setTimeout(() => setAnimClass(''), 180)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, duration])

  return { displayVal, animClass }
}
