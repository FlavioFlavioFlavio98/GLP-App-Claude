import { useState, useEffect } from 'react'
import { getExerciseIconPath } from '../lib/exerciseIcons'

// Icona immagine per esercizio con fallback automatico all'emoji — finché non
// esiste il file public/exercise-icons/{slug}.png (esercizio nuovo, icona non
// ancora pronta) mostra semplicemente exercise.emoji come prima, senza rotture.
export default function ExerciseIcon({ exercise, size = 28, style }) {
  const path = getExerciseIconPath(exercise)
  const [failed, setFailed] = useState(false)

  // Reset del fallback quando cambia l'esercizio mostrato (riuso dello stesso
  // componente in una lista con key stabile potrebbe altrimenti "bloccarsi"
  // sullo stato di errore dell'esercizio precedente)
  useEffect(() => { setFailed(false) }, [path])

  if (!path || failed) {
    return (
      <span style={{ fontSize: size * 0.82, lineHeight: 1, flexShrink: 0, ...style }}>
        {exercise?.emoji || '💪'}
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
      onError={() => setFailed(true)}
    />
  )
}
