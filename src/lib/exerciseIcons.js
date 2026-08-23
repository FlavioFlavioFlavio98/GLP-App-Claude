// Icone immagine per esercizio, al posto dell'emoji singola — file statici in
// public/exercise-icons/{slug}.png, dove {slug} deriva dal NOME dell'esercizio
// (non serve un campo Firestore in più: basta salvare l'immagine col nome giusto).
// Se il file non esiste (esercizio nuovo, icona non ancora pronta) si ricade
// automaticamente sull'emoji — vedi ExerciseIcon.jsx.

export function slugifyExerciseName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getExerciseIconPath(exercise) {
  const slug = slugifyExerciseName(exercise?.name)
  if (!slug) return null
  return `${import.meta.env.BASE_URL}exercise-icons/${slug}.png`
}
