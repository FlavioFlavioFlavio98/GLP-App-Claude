import { useState, useEffect } from 'react'
import { getExerciseIconPaths } from '../lib/exerciseIcons'

// Icona immagine per esercizio con fallback automatico all'emoji — prova in
// sequenza png/jpg/jpeg (vedi getExerciseIconPaths) e, se nessuno esiste
// (esercizio nuovo, icona non ancora pronta), mostra exercise.emoji come prima.
export default function ExerciseIcon({ exercise, size = 28, style }) {
  const paths = getExerciseIconPaths(exercise)
  const [attempt, setAttempt] = useState(0)

  // Reset del tentativo quando cambia l'esercizio mostrato (riuso dello stesso
  // componente in una lista con key stabile potrebbe altrimenti "bloccarsi"
  // sullo stato di errore dell'esercizio precedente)
  useEffect(() => { setAttempt(0) }, [exercise?.name])

  const path = paths[attempt]

  if (!path) {
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
      onError={() => setAttempt(a => a + 1)}
    />
  )
}
