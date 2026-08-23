import { useState, useEffect } from 'react'
import { getFoodIconPaths } from '../lib/foodIcons'

// Icona immagine per alimento con fallback automatico all'emoji — stesso
// componente di ExerciseIcon.jsx ma per public/food-icons/.
export default function FoodIcon({ food, size = 28, style }) {
  const paths = getFoodIconPaths(food)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { setAttempt(0) }, [food?.name])

  const path = paths[attempt]

  if (!path) {
    return (
      <span style={{ fontSize: size * 0.82, lineHeight: 1, flexShrink: 0, ...style }}>
        {food?.emoji || '🍽️'}
      </span>
    )
  }

  return (
    <img
      src={path}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0, ...style }}
      onError={() => setAttempt(a => a + 1)}
    />
  )
}
