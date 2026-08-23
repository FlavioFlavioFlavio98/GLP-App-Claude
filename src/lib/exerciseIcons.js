// Icone immagine per esercizio, al posto dell'emoji singola — file statici in
// public/exercise-icons/{slug}.{ext}, dove {slug} deriva dal NOME dell'esercizio
// (non serve un campo Firestore in più: basta salvare l'immagine col nome giusto).
// Se il file non esiste (esercizio nuovo, icona non ancora pronta) si ricade
// automaticamente sull'emoji — vedi ExerciseIcon.jsx.

const ICON_EXTENSIONS = ['png', 'jpg', 'jpeg']

export function slugifyExerciseName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Ritorna tutti i percorsi candidati in ordine di priorità (png prima, poi
// jpg/jpeg) — ExerciseIcon.jsx li prova in sequenza finché uno non carica.
export function getExerciseIconPaths(exercise) {
  const slug = slugifyExerciseName(exercise?.name)
  if (!slug) return []
  return ICON_EXTENSIONS.map(ext => `${import.meta.env.BASE_URL}exercise-icons/${slug}.${ext}`)
}
