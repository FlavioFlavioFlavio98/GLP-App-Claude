import { toDateString } from './habitLogic'
import { getMusclesForExercise } from './muscleMapping'

// ─── Sforzo pesato ──────────────────────────────────────────────────────────────
// Ogni log entry ha già `pts` (reps × pt/rep valido alla data di quel log — vedi
// _getPPR in store.jsx), quindi lo sforzo è semplicemente la somma di quei punti.
// Usare `pts` invece di ricalcolare reps×ppr "adesso" è corretto: preserva il
// valore storico anche se l'utente cambia in seguito il pt/rep di un esercizio.
export function calculateWorkoutEffort(entries) {
  const total = (entries || []).reduce((sum, e) => sum + (parseFloat(e.pts) || 0), 0)
  return Math.round(total * 100) / 100
}

// Sforzo totale di un singolo giorno, sommando tutti gli esercizi loggati
export function getDayEffort(exerciseLog, dateStr) {
  return calculateWorkoutEffort(exerciseLog?.[dateStr] || [])
}

// ─── Banner motivazionale ───────────────────────────────────────────────────────

// L'esercizio dell'ultima serie loggata oggi (per data+ora), usato per decidere
// il messaggio del banner subito dopo un salvataggio.
export function getMostRecentLoggedExercise(exerciseLog, quickExercises) {
  const todayStr = toDateString(new Date())
  const entries = exerciseLog?.[todayStr] || []
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const last = sorted[sorted.length - 1]
  const exercise = (quickExercises || []).find(e => e.id === last.exerciseId)
  return exercise ? { exercise, entry: last } : null
}

// Confronta le ripetizioni di oggi per un esercizio col record storico
// (il miglior giorno PRIMA di oggi, mai includendo oggi nel confronto).
export function getExerciseRecordStatus(exerciseLog, exerciseId) {
  const todayStr = toDateString(new Date())

  function repsOnDate(d) {
    return (exerciseLog?.[d] || []).filter(s => s.exerciseId === exerciseId).reduce((a, s) => a + s.reps, 0)
  }

  let prevBestReps = 0, prevBestDate = null
  Object.keys(exerciseLog || {}).forEach(d => {
    if (d === todayStr) return
    const r = repsOnDate(d)
    if (r > prevBestReps) { prevBestReps = r; prevBestDate = d }
  })

  const todayReps = repsOnDate(todayStr)
  const isNewRecord = prevBestDate !== null && todayReps > prevBestReps
  const remaining = Math.max(0, prevBestReps - todayReps)
  // "Vicino al record": manca al massimo il 20% del record per raggiungerlo
  const closeToRecord = prevBestReps > 0 && !isNewRecord && remaining > 0 && remaining <= prevBestReps * 0.2

  return { todayReps, prevBestReps, prevBestDate, isNewRecord, remaining, closeToRecord }
}

// Confronta lo sforzo pesato di oggi con tutti i giorni storici in cui l'utente
// si è effettivamente allenato (sforzo > 0) — esclude i giorni a zero dal conteggio.
export function getEffortPercentile(exerciseLog) {
  const todayStr = toDateString(new Date())
  const todayEffort = getDayEffort(exerciseLog, todayStr)

  const historicalEfforts = Object.keys(exerciseLog || {})
    .filter(d => d !== todayStr)
    .map(d => getDayEffort(exerciseLog, d))
    .filter(e => e > 0)

  if (historicalEfforts.length === 0) {
    return { todayEffort, percentile: null, totalDays: 0 }
  }

  const betterThanCount = historicalEfforts.filter(e => e < todayEffort).length
  const percentile = Math.round((betterThanCount / historicalEfforts.length) * 100)
  return { todayEffort, percentile, totalDays: historicalEfforts.length }
}

// ─── Sessione di allenamento (finestra temporale, non un campo Firestore) ──────
// Vedi CLAUDE.md / discussione Fase 0: la sessione è un puntatore leggero in
// localStorage, mai un nuovo campo su exerciseLog. Una serie "appartiene" alla
// sessione corrente se è stata loggata OGGI con orario >= inizio sessione.

const SESSION_STORAGE_KEY = 'glp_workout_session'
export const SESSION_TIMEOUT_MS = 45 * 60 * 1000 // 45 minuti di inattività

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.startedAt || !session?.lastActivityAt) return null
    return session
  } catch {
    return null
  }
}

function isSessionValid(session) {
  if (!session) return false
  if (Date.now() - session.lastActivityAt > SESSION_TIMEOUT_MS) return false
  // Una sessione non attraversa mai la mezzanotte: se è iniziata un giorno
  // diverso da oggi, va considerata scaduta anche se entro i 45 minuti.
  if (toDateString(new Date(session.startedAt)) !== toDateString(new Date())) return false
  return true
}

// Ritorna la sessione attiva, o null se non esiste/è scaduta (non la crea).
export function getActiveWorkoutSession() {
  const session = readStoredSession()
  return isSessionValid(session) ? session : null
}

// Da chiamare ogni volta che viene loggata una serie: apre una nuova sessione
// se non ce n'è una valida, altrimenti aggiorna solo l'orario di ultima attività.
// Ritorna sempre la sessione risultante (mai stati intermedi ambigui).
export function touchWorkoutSession() {
  const existing = getActiveWorkoutSession()
  const now = Date.now()
  const session = existing
    ? { ...existing, lastActivityAt: now }
    : { startedAt: now, lastActivityAt: now }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  return session
}

// Chiusura esplicita (bottone "Termina sessione")
export function endWorkoutSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

function timeStrToMs(dateStr, timeStr) {
  if (!timeStr) return 0
  const [h, m, s] = timeStr.split(':').map(Number)
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(h || 0, m || 0, s || 0, 0)
  return d.getTime()
}

// Tutte le serie di oggi che appartengono alla sessione data (qualsiasi esercizio)
export function getSessionLogEntries(exerciseLog, session) {
  if (!session) return []
  const todayStr = toDateString(new Date())
  const todayEntries = exerciseLog?.[todayStr] || []
  return todayEntries.filter(e => timeStrToMs(todayStr, e.time) >= session.startedAt)
}

// ─── Muscoli coinvolti (per lo step "gruppo muscolare" del flusso Aggiungi serie) ──

export function getPrimaryMuscleGroup(exercise) {
  const muscles = getMusclesForExercise(exercise)
  const entries = Object.entries(muscles)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

// Raggruppa gli esercizi per gruppo muscolare primario. Gli esercizi senza
// mappatura riconoscibile finiscono in 'altro'.
export function groupExercisesByMuscle(exercises) {
  const groups = {}
  ;(exercises || []).forEach(ex => {
    const key = getPrimaryMuscleGroup(ex) || 'altro'
    if (!groups[key]) groups[key] = []
    groups[key].push(ex)
  })
  return groups
}

// ─── Record & streak per esercizio (estratte da ExerciseSingleView per riuso) ──

export function computeStreak(exerciseLog, exerciseId) {
  const dates = Object.keys(exerciseLog || {})
    .filter(d => (exerciseLog[d] || []).some(s => s.exerciseId === exerciseId))
    .sort()

  if (!dates.length) return { current: 0, best: 0, bestStart: null, bestEnd: null, currentStart: null }

  const runs = []
  let runStart = dates[0], runLen = 1

  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000)
    if (diff === 1) { runLen++ }
    else { runs.push({ start: runStart, end: dates[i - 1], len: runLen }); runStart = dates[i]; runLen = 1 }
  }
  runs.push({ start: runStart, end: dates.at(-1), len: runLen })

  const best = runs.reduce((a, b) => b.len > a.len ? b : a, runs[0])

  const todayStr     = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  const last = runs.at(-1)
  const isContinuing = last.end === todayStr || last.end === yesterdayStr
  const current = isContinuing ? last.len : 0
  const currentStart = isContinuing ? last.start : null

  return { current, currentStart, best: best.len, bestStart: best.start, bestEnd: best.end }
}

export function computeAllStats(exerciseLog, exerciseId) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = toDateString(today)

  const allDates = Object.keys(exerciseLog || {}).sort()

  function repsOnDate(d) {
    return (exerciseLog[d] || []).filter(s => s.exerciseId === exerciseId).reduce((a, s) => a + s.reps, 0)
  }
  function sessionsOnDate(d) {
    return (exerciseLog[d] || []).filter(s => s.exerciseId === exerciseId)
  }

  // ── Lifetime ──
  let lifetimeReps = 0, lifetimeSessions = 0
  allDates.forEach(d => {
    const ss = sessionsOnDate(d)
    ss.forEach(s => { lifetimeReps += s.reps; lifetimeSessions++ })
  })
  const avgPerSession = lifetimeSessions > 0 ? Math.round(lifetimeReps / lifetimeSessions) : 0

  // ── Week ──
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6)
  const lastWeekStart = new Date(today); lastWeekStart.setDate(today.getDate() - 13)
  const lastWeekEnd   = new Date(today); lastWeekEnd.setDate(today.getDate() - 7)
  const weekStartStr     = toDateString(weekStart)
  const lastWeekStartStr = toDateString(lastWeekStart)
  const lastWeekEndStr   = toDateString(lastWeekEnd)

  let weekReps = 0, lastWeekReps = 0
  allDates.forEach(d => {
    if (d >= weekStartStr)       weekReps     += repsOnDate(d)
    if (d >= lastWeekStartStr && d <= lastWeekEndStr) lastWeekReps += repsOnDate(d)
  })
  const weekDelta = lastWeekReps === 0 ? null : Math.round((weekReps - lastWeekReps) / lastWeekReps * 100)

  // ── Month ──
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const monthPrefix = `${today.getFullYear()}-${mm}`
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  let monthReps = 0, lastMonthReps = 0
  allDates.forEach(d => {
    if (d.startsWith(monthPrefix))     monthReps     += repsOnDate(d)
    if (d.startsWith(lastMonthPrefix)) lastMonthReps += repsOnDate(d)
  })
  const monthDelta = lastMonthReps === 0 ? null : Math.round((monthReps - lastMonthReps) / lastMonthReps * 100)

  // ── Records ──
  let bestSession = null, bestSessionReps = 0, bestSessionDate = null
  let bestDay = null, bestDayReps = 0
  allDates.forEach(d => {
    const dayTotal = repsOnDate(d)
    if (dayTotal > bestDayReps) { bestDayReps = dayTotal; bestDay = d }
    sessionsOnDate(d).forEach(s => {
      if (s.reps > bestSessionReps) { bestSessionReps = s.reps; bestSession = s; bestSessionDate = d }
    })
  })

  // ── Today ──
  const todayReps = repsOnDate(todayStr)
  const todaySessions = sessionsOnDate(todayStr)
  const isNewRecord = todaySessions.length > 0 && bestSessionDate === todayStr && lifetimeSessions > 1

  // ── Streak ──
  const streak = computeStreak(exerciseLog, exerciseId)

  return {
    lifetimeReps, lifetimeSessions, avgPerSession,
    weekReps, lastWeekReps, weekDelta,
    monthReps, lastMonthReps, monthDelta,
    bestSessionReps, bestSessionDate,
    bestDayReps, bestDay,
    todayReps, todaySessions,
    isNewRecord,
    streak,
  }
}
