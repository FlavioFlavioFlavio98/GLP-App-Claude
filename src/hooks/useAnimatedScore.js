import { useEffect, useRef, useState } from 'react'

export function useAnimatedScore(target) {
  const [display, setDisplay] = useState(target)
  const [delta, setDelta] = useState(null) // { value, key } for the +X/-X flash
  const prev = useRef(target)

  useEffect(() => {
    if (prev.current === target) return
    const start = prev.current
    const end = target
    const diff = end - start
    const duration = 600
    const startTime = performance.now()

    // Show delta badge
    setDelta({ value: diff, key: Date.now() })

    // Clear delta badge after fade animation completes
    const timer = setTimeout(() => setDelta(null), 1600)

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easing ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(tick)
      else prev.current = end
    }
    requestAnimationFrame(tick)

    return () => clearTimeout(timer)
  }, [target])

  return { display, delta }
}
