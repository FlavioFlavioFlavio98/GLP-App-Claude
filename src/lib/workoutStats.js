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

// ─── Obiettivo di sforzo giornaliero ─────────────────────────────────────────────
// Suggerito = media dello sforzo nei giorni di allenamento recenti (default 14gg,
// solo giorni con sforzo > 0) con una leggera crescita incrementale (+5% default).
export function getSuggestedDailyGoal(exerciseLog, days = 14, growth = 1.05) {
  const todayStr = toDateString(new Date())
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = toDateString(cutoff)

  const recentEfforts = Object.keys(exerciseLog || {})
    .filter(d => d !== todayStr && d >= cutoffStr)
    .map(d => getDayEffort(exerciseLog, d))
    .filter(e => e > 0)

  if (recentEfforts.length === 0) return 20 // fallback ragionevole per chi inizia ora

  const avg = recentEfforts.reduce((a, b) => a + b, 0) / recentEfforts.length
  return Math.round(avg * growth * 10) / 10
}

const GOAL_OVERRIDE_PREFIX = 'glp_workout_goal_'

// L'obiettivo del giorno: quello impostato manualmente per OGGI se presente,
// altrimenti il suggerito. L'override è per-giorno: domani si ricalcola da capo
// sulla nuova media, così la progressione incrementale non resta bloccata da una
// modifica manuale fatta settimane prima.
export function getDailyGoal(exerciseLog) {
  const todayStr = toDateString(new Date())
  try {
    const stored = localStorage.getItem(GOAL_OVERRIDE_PREFIX + todayStr)
    if (stored !== null) {
      const n = parseFloat(stored)
      if (!isNaN(n) && n > 0) return { value: n, isCustom: true }
    }
  } catch { /* localStorage non disponibile */ }
  return { value: getSuggestedDailyGoal(exerciseLog), isCustom: false }
}

export function setDailyGoalOverride(value) {
  const todayStr = toDateString(new Date())
  try {
    if (value === null || value === undefined) localStorage.removeItem(GOAL_OVERRIDE_PREFIX + todayStr)
    else localStorage.setItem(GOAL_OVERRIDE_PREFIX + todayStr, String(value))
  } catch { /* localStorage non disponibile */ }
}

// ─── Timer di recupero ───────────────────────────────────────────────────────────
// Anche questo vive solo in localStorage (come la sessione): nessun campo Firestore,
// il countdown è puramente un aiuto visivo lato client durante l'allenamento.

const REST_DURATION_KEY = 'glp_workout_rest_duration' // default generale, in secondi
const REST_TIMER_KEY = 'glp_workout_rest_timer'        // countdown attivo
export const DEFAULT_REST_SECONDS = 90

export function getRestDuration() {
  try {
    const stored = localStorage.getItem(REST_DURATION_KEY)
    const n = parseInt(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_REST_SECONDS
  } catch { return DEFAULT_REST_SECONDS }
}

export function setRestDuration(seconds) {
  try { localStorage.setItem(REST_DURATION_KEY, String(Math.max(10, Math.round(seconds)))) } catch { /* ignore */ }
}

// Avvia (o riavvia) il countdown — da chiamare dopo ogni serie salvata oggi.
export function startRestTimer(durationSeconds) {
  const duration = durationSeconds || getRestDuration()
  const timer = { startedAt: Date.now(), duration }
  try { localStorage.setItem(REST_TIMER_KEY, JSON.stringify(timer)) } catch { /* ignore */ }
  return timer
}

// Estende/riduce il countdown attivo "al volo" (es. +15s/-15s), senza toccare il
// default generale nelle impostazioni.
export function adjustRestTimer(deltaSeconds) {
  const active = getActiveRestTimer()
  if (!active) return null
  const remaining = Math.max(0, active.remaining + deltaSeconds)
  const timer = { startedAt: Date.now(), duration: remaining }
  try { localStorage.setItem(REST_TIMER_KEY, JSON.stringify(timer)) } catch { /* ignore */ }
  return timer
}

export function getActiveRestTimer() {
  try {
    const raw = localStorage.getItem(REST_TIMER_KEY)
    if (!raw) return null
    const timer = JSON.parse(raw)
    if (!timer?.startedAt || !timer?.duration) return null
    const elapsed = (Date.now() - timer.startedAt) / 1000
    const remaining = Math.max(0, timer.duration - elapsed)
    return { ...timer, remaining, finished: remaining <= 0 }
  } catch { return null }
}

export function cancelRestTimer() {
  try { localStorage.removeItem(REST_TIMER_KEY) } catch { /* ignore */ }
}

// Beep leggero (Web Audio, nessun asset esterno) + vibrazione a fine countdown.
// Va bene se il beep non parte (es. contesto audio bloccato dal browser finché
// l'utente non ha interagito con la pagina) — resta comunque la vibrazione e
// l'indicatore visivo nel componente del timer.
export function playRestFinishedAlert() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
      osc.onended = () => ctx.close()
    }
  } catch { /* audio non disponibile, va bene */ }
  try { navigator.vibrate?.([120, 60, 120]) } catch { /* vibration non disponibile */ }
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

const SESSION_SEEN_KEY = 'glp_workout_session_last_seen'

// Sessione appena scaduta per inattività (45 min) e MAI mostrata come riepilogo —
// da controllare all'apertura della tab Workout per proporre il recap anche se
// l'utente non ha premuto esplicitamente "Termina sessione".
export function getUnseenExpiredSession() {
  const raw = readStoredSession()
  if (!raw) return null
  if (isSessionValid(raw)) return null // ancora attiva, non è "finita"
  try {
    if (String(raw.startedAt) === localStorage.getItem(SESSION_SEEN_KEY)) return null
  } catch { /* ignore */ }
  return raw
}

// Segna una sessione come "vista" (riepilogo mostrato o scartato) così non ricompare.
export function markSessionSeen(session) {
  if (!session) return
  try { localStorage.setItem(SESSION_SEEN_KEY, String(session.startedAt)) } catch { /* ignore */ }
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

// I log entry salvano solo `HH:MM:SS` (niente millisecondi — vedi addExerciseSession
// in store.jsx), quindi confrontarli con un timestamp ms-precision come startedAt
// può escludere per errore la primissima serie di una sessione (i suoi ms vengono
// troncati verso il basso alla ricostruzione). Si arrotonda il confine al secondo
// per non perdere quella serie.
function floorToSecond(ms) {
  return Math.floor(ms / 1000) * 1000
}

// Tutte le serie di oggi che appartengono alla sessione data (qualsiasi esercizio)
export function getSessionLogEntries(exerciseLog, session) {
  if (!session) return []
  const todayStr = toDateString(new Date())
  const todayEntries = exerciseLog?.[todayStr] || []
  const startFloor = floorToSecond(session.startedAt)
  return todayEntries.filter(e => timeStrToMs(todayStr, e.time) >= startFloor)
}

// Serie in un intervallo [startMs, endMs] preciso — usata per il riepilogo di fine
// sessione, dove serve anche un limite superiore (altrimenti, se nel frattempo si è
// già aperta una nuova sessione, ne includerebbe erroneamente le serie).
export function getEntriesInTimeRange(exerciseLog, startMs, endMs) {
  const todayStr = toDateString(new Date(startMs))
  const todayEntries = exerciseLog?.[todayStr] || []
  const startFloor = floorToSecond(startMs)
  const endCeil = Math.ceil(endMs / 1000) * 1000
  return todayEntries.filter(e => {
    const ms = timeStrToMs(todayStr, e.time)
    return ms >= startFloor && ms <= endCeil
  })
}

// ─── Sforzo percepito della serie (1=leggero, 2=medio, 3=sfinimento) ────────────
// Bonus punti per premiare le serie portate a sfinimento: a parità di reps, una
// serie massimale è più produttiva di una di riscaldamento. Salvato come `effort`
// sul singolo log entry (default 1 per le serie pre-esistenti, che non lo hanno).
export const EFFORT_MULTIPLIERS = { 1: 1, 2: 1.2, 3: 1.5 }
export const DEFAULT_EFFORT = 1

export function getEffortMultiplier(effort) {
  return EFFORT_MULTIPLIERS[effort] || EFFORT_MULTIPLIERS[DEFAULT_EFFORT]
}

const EFFORT_EMOJI = { 1: '🟢', 2: '🟡', 3: '🔴' }
export function getEffortEmoji(effort) {
  return EFFORT_EMOJI[effort] || ''
}

// ─── Media ripetizioni per sessione (confronto live nel flusso Aggiungi serie) ──
export function getAverageRepsPerSession(exerciseLog, exerciseId) {
  let totalReps = 0, count = 0
  Object.values(exerciseLog || {}).forEach(entries => {
    ;(entries || []).filter(e => e.exerciseId === exerciseId).forEach(e => { totalReps += e.reps; count++ })
  })
  return count > 0 ? totalReps / count : 0
}

// ─── Ultimo carico usato per un esercizio ──────────────────────────────────────
// Il carico non è un default fisso ma "l'ultimo usato" — il 90% delle volte non
// cambia da una serie all'altra, quindi vale la pena ricordarlo automaticamente
// invece di richiederlo ogni volta. Derivato dal log stesso (nessun campo extra
// da mantenere sincronizzato): cerca l'entry più recente per data+ora.
export function getLastUsedLoad(exerciseLog, exerciseId) {
  let lastDate = null, lastTime = '', lastLoad = 0
  Object.entries(exerciseLog || {}).forEach(([dateStr, entries]) => {
    ;(entries || []).filter(e => e.exerciseId === exerciseId).forEach(e => {
      if (e.load === undefined || e.load === null) return
      if (lastDate === null || dateStr > lastDate || (dateStr === lastDate && (e.time || '') > lastTime)) {
        lastDate = dateStr; lastTime = e.time || ''; lastLoad = e.load
      }
    })
  })
  return lastLoad
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

// ─── Rilevamento plateau ──────────────────────────────────────────────────────
// Confronta lo sforzo (reps totali) delle ultime N sessioni di allenamento di un
// esercizio con quello del blocco di sessioni immediatamente precedente. Se la
// crescita è sotto soglia, l'esercizio è "in plateau". Richiede uno storico
// minimo per evitare falsi positivi su esercizi appena iniziati.
const PLATEAU_WINDOW = 4 // quante sessioni (giorni distinti) confrontare per blocco
const PLATEAU_MIN_DAYS = PLATEAU_WINDOW * 2
const PLATEAU_GROWTH_THRESHOLD = 0.05 // sotto il 5% di crescita = plateau

export function detectPlateau(exerciseLog, exerciseId) {
  const dates = Object.keys(exerciseLog || {})
    .filter(d => (exerciseLog[d] || []).some(s => s.exerciseId === exerciseId))
    .sort()

  if (dates.length < PLATEAU_MIN_DAYS) return null

  function repsOnDate(d) {
    return (exerciseLog[d] || []).filter(s => s.exerciseId === exerciseId).reduce((a, s) => a + s.reps, 0)
  }

  const recentDates = dates.slice(-PLATEAU_WINDOW)
  const previousDates = dates.slice(-PLATEAU_WINDOW * 2, -PLATEAU_WINDOW)

  const recentAvg = recentDates.reduce((a, d) => a + repsOnDate(d), 0) / recentDates.length
  const previousAvg = previousDates.reduce((a, d) => a + repsOnDate(d), 0) / previousDates.length

  if (previousAvg <= 0) return null

  const growth = (recentAvg - previousAvg) / previousAvg
  const isPlateau = growth < PLATEAU_GROWTH_THRESHOLD

  return {
    isPlateau,
    growthPct: Math.round(growth * 100),
    recentAvg: Math.round(recentAvg * 10) / 10,
    previousAvg: Math.round(previousAvg * 10) / 10,
    sessionsAnalyzed: PLATEAU_WINDOW,
  }
}

// ─── "Da quanto non batti un record" ─────────────────────────────────────────
// Richiede uno storico minimo (giorni distinti allenati) per evitare di mostrare
// l'indicatore su esercizi appena iniziati, dove ogni giorno è per forza un record.
export const MIN_TRAINING_DAYS_FOR_RECORD = 5

export function getDaysSinceLastRecord(exerciseLog, exerciseId) {
  const dates = Object.keys(exerciseLog || {})
    .filter(d => (exerciseLog[d] || []).some(s => s.exerciseId === exerciseId))

  if (dates.length < MIN_TRAINING_DAYS_FOR_RECORD) return null

  function repsOnDate(d) {
    return (exerciseLog[d] || []).filter(s => s.exerciseId === exerciseId).reduce((a, s) => a + s.reps, 0)
  }

  let bestDay = null, bestReps = 0
  dates.forEach(d => {
    const r = repsOnDate(d)
    if (r > bestReps) { bestReps = r; bestDay = d }
  })
  if (!bestDay) return null

  const days = Math.round((new Date(toDateString(new Date())) - new Date(bestDay)) / 86400000)
  return { days, bestDay, bestReps }
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

  // ── Ultimi 30 giorni (finestra rolling, non mese solare) ──
  const monthStart = new Date(today); monthStart.setDate(today.getDate() - 29)
  const lastMonthStart = new Date(today); lastMonthStart.setDate(today.getDate() - 59)
  const lastMonthEnd   = new Date(today); lastMonthEnd.setDate(today.getDate() - 30)
  const monthStartStr     = toDateString(monthStart)
  const lastMonthStartStr = toDateString(lastMonthStart)
  const lastMonthEndStr   = toDateString(lastMonthEnd)

  let monthReps = 0, lastMonthReps = 0
  allDates.forEach(d => {
    if (d >= monthStartStr)     monthReps     += repsOnDate(d)
    if (d >= lastMonthStartStr && d <= lastMonthEndStr) lastMonthReps += repsOnDate(d)
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

// ─── Riepilogo di fine sessione ─────────────────────────────────────────────────
// Lo storico sessioni vive anch'esso solo in localStorage (max 60 voci): non è un
// dato retroattivo (prima di questa funzionalità non esistevano sessioni), ma da
// qui in avanti permette un vero confronto "sessioni con lo stesso focus muscolare"
// invece di un fallback generico ogni volta.

const SESSION_HISTORY_KEY = 'glp_workout_session_history'
const MAX_SESSION_HISTORY = 60

function readSessionHistory() {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function saveSessionToHistory(record) {
  try {
    const list = readSessionHistory()
    list.push(record)
    while (list.length > MAX_SESSION_HISTORY) list.shift()
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

// Ripartizione delle ripetizioni per gruppo muscolare in un set di log entry, più
// il "focus" dominante: il gruppo che da solo supera il 50% delle rip. totali della
// sessione, se esiste — altrimenti la sessione è considerata "mista" (focus null).
function computeMuscleBreakdown(entries, quickExercises) {
  const exMap = {}
  ;(quickExercises || []).forEach(e => { exMap[e.id] = e })

  const repsByMuscle = {}
  let totalReps = 0
  entries.forEach(e => {
    const ex = exMap[e.exerciseId]
    if (!ex) return
    const key = getPrimaryMuscleGroup(ex) || 'altro'
    repsByMuscle[key] = (repsByMuscle[key] || 0) + e.reps
    totalReps += e.reps
  })

  const groups = Object.entries(repsByMuscle)
    .map(([key, reps]) => ({ key, reps }))
    .sort((a, b) => b.reps - a.reps)

  const focus = (groups.length > 0 && totalReps > 0 && groups[0].reps / totalReps > 0.5)
    ? groups[0].key
    : null

  return { groups, focus }
}

// Calcola il riepilogo completo di una sessione conclusa (esplicitamente o per
// scadenza). Salva anche la sessione nello storico locale per i confronti futuri.
export function computeSessionSummary(exerciseLog, quickExercises, session, endedAtMs) {
  const endMs = endedAtMs || session.lastActivityAt
  const entries = getEntriesInTimeRange(exerciseLog, session.startedAt, endMs)
  const totalEffort = calculateWorkoutEffort(entries)
  const { groups: muscleGroups, focus } = computeMuscleBreakdown(entries, quickExercises)

  // Record battuti: per ogni esercizio coinvolto, il totale ODIERNO (di solito
  // coincide con quello della sessione, salvo più sessioni nello stesso giorno)
  // supera il miglior giorno storico precedente a oggi.
  const exerciseIds = [...new Set(entries.map(e => e.exerciseId))]
  const exMap = {}
  ;(quickExercises || []).forEach(e => { exMap[e.id] = e })
  const recordsBroken = exerciseIds
    .map(exId => ({ exercise: exMap[exId], status: getExerciseRecordStatus(exerciseLog, exId) }))
    .filter(r => r.exercise && r.status.isNewRecord)

  // Confronto storico: prova prima con sessioni passate dello stesso focus
  // muscolare; se non ce ne sono (o questa sessione è "mista"), confronto generale
  // con tutte le sessioni passate registrate.
  const history = readSessionHistory()
  let comparison = null
  if (focus) {
    const sameFocus = history.filter(h => h.focus === focus)
    if (sameFocus.length > 0) {
      const avgEffort = sameFocus.reduce((a, h) => a + h.effort, 0) / sameFocus.length
      comparison = {
        type: 'focus', focus, count: sameFocus.length,
        avgEffort: Math.round(avgEffort * 10) / 10,
        deltaPct: avgEffort > 0 ? Math.round((totalEffort - avgEffort) / avgEffort * 100) : null,
      }
    }
  }
  if (!comparison && history.length > 0) {
    const avgEffort = history.reduce((a, h) => a + h.effort, 0) / history.length
    comparison = {
      type: 'general', focus: null, count: history.length,
      avgEffort: Math.round(avgEffort * 10) / 10,
      deltaPct: avgEffort > 0 ? Math.round((totalEffort - avgEffort) / avgEffort * 100) : null,
    }
  }

  // Salva questa sessione nello storico DOPO aver calcolato il confronto (altrimenti
  // si confronterebbe con se stessa)
  saveSessionToHistory({
    startedAt: session.startedAt, endedAt: endMs,
    effort: totalEffort, focus, exerciseCount: exerciseIds.length,
  })

  return {
    startedAt: session.startedAt, endedAt: endMs,
    durationMin: Math.max(1, Math.round((endMs - session.startedAt) / 60000)),
    totalEffort, entries, muscleGroups, focus,
    recordsBroken, comparison,
  }
}

// ─── Heatmap allenamenti ──────────────────────────────────────────────────────
// Stessa griglia settimane×giorni della heatmap abitudini esistente (StatsPage.jsx
// -> buildAnnualHeatmap), ma colorata sullo sforzo pesato invece che sul netto punti.
export function buildWorkoutHeatmap(exerciseLog, year) {
  const today = new Date()
  const cells = []

  const jan1 = new Date(year, 0, 1)
  const startDow = (jan1.getDay() + 6) % 7 // 0=Lun..6=Dom
  const start = new Date(jan1)
  start.setDate(jan1.getDate() - startDow)

  const d = new Date(start)
  for (let w = 0; w < 53; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = toDateString(d)
      const inYear = d.getFullYear() === year
      const inFuture = d > today
      const effort = (inYear && !inFuture) ? getDayEffort(exerciseLog, dateStr) : 0
      cells.push({
        dateStr, effort, hasData: effort > 0,
        dow, month: d.getMonth(), day: d.getDate(), week: w, inYear: inYear && !inFuture,
      })
      d.setDate(d.getDate() + 1)
    }
  }
  return cells
}

// Vista compatta "ultime N settimane" (rolling, ancorata a oggi) — usata nella
// tab Workout al posto della griglia annuale completa, poco leggibile in
// miniatura. La griglia annuale resta disponibile nella vista espansa.
export function buildRecentWeeksHeatmap(exerciseLog, weeksBack = 14) {
  const today = new Date()
  const totalDays = weeksBack * 7
  // Ancora la fine alla domenica corrente, così le colonne sono sempre complete
  const dowMon0 = (today.getDay() + 6) % 7 // 0=Lun..6=Dom
  const end = new Date(today); end.setDate(today.getDate() + (6 - dowMon0))
  const start = new Date(end); start.setDate(end.getDate() - totalDays + 1)

  const cells = []
  const d = new Date(start)
  for (let i = 0; i < totalDays; i++) {
    const dateStr = toDateString(d)
    const inFuture = d > today
    const effort = !inFuture ? getDayEffort(exerciseLog, dateStr) : 0
    cells.push({
      dateStr, effort, hasData: effort > 0,
      dow: (d.getDay() + 6) % 7, month: d.getMonth(), day: d.getDate(),
      week: Math.floor(i / 7), inYear: !inFuture,
    })
    d.setDate(d.getDate() + 1)
  }
  return cells
}

// Streak "globale" (qualsiasi esercizio, non uno specifico) — stessa logica di
// computeStreak ma su tutti i giorni in cui c'è stato sforzo > 0.
export function computeGlobalWorkoutStreak(exerciseLog) {
  const dates = Object.keys(exerciseLog || {})
    .filter(d => getDayEffort(exerciseLog, d) > 0)
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

// ─── Mobility ───────────────────────────────────────────────────────────────
// Sessioni di mobility/stretching, tracciate separatamente dall'allenamento
// vero e proprio (mobilityLog, non exerciseLog): niente esercizio/reps, solo
// durata in minuti. Il punteggio è durata × tasso — il tasso è una preferenza
// locale (come il timer di recupero), non un dato per-esercizio su Firestore.

const MOBILITY_RATE_KEY = 'glp_mobility_pts_per_min'
export const DEFAULT_MOBILITY_RATE = 1

export function getMobilityRate() {
  try {
    const stored = localStorage.getItem(MOBILITY_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MOBILITY_RATE
  } catch { return DEFAULT_MOBILITY_RATE }
}

export function setMobilityRate(rate) {
  try { localStorage.setItem(MOBILITY_RATE_KEY, String(Math.max(0.1, rate))) } catch { /* ignore */ }
}

export function getDayMobilityEffort(mobilityLog, dateStr) {
  const total = (mobilityLog?.[dateStr] || []).reduce((sum, s) => sum + (parseFloat(s.pts) || 0), 0)
  return Math.round(total * 100) / 100
}

// Streak sui giorni con almeno una sessione mobility — stessa logica di
// computeGlobalWorkoutStreak, applicata a mobilityLog invece che exerciseLog.
export function computeMobilityStreak(mobilityLog) {
  const dates = Object.keys(mobilityLog || {})
    .filter(d => getDayMobilityEffort(mobilityLog, d) > 0)
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

// Statistiche aggregate mobility — oggi, ultimi 7gg, lifetime, streak. Usate
// dalla card statistiche nella tab Workout.
export function computeMobilityStats(mobilityLog) {
  const todayStr = toDateString(new Date())
  const allDates = Object.keys(mobilityLog || {})

  function minutesOnDate(d) {
    return (mobilityLog?.[d] || []).reduce((a, s) => a + (parseFloat(s.duration) || 0), 0)
  }

  const todayMinutes = minutesOnDate(todayStr)
  const todayPts = getDayMobilityEffort(mobilityLog, todayStr)

  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const weekMinutes = allDates.filter(d => d >= weekCutoff).reduce((a, d) => a + minutesOnDate(d), 0)

  const lifetimeMinutes = allDates.reduce((a, d) => a + minutesOnDate(d), 0)
  const lifetimePts = Math.round(allDates.reduce((a, d) => a + getDayMobilityEffort(mobilityLog, d), 0) * 10) / 10
  const sessionCount = allDates.reduce((a, d) => a + (mobilityLog?.[d]?.length || 0), 0)

  const streak = computeMobilityStreak(mobilityLog)

  return { todayMinutes, todayPts, weekMinutes, lifetimeMinutes, lifetimePts, sessionCount, streak }
}
