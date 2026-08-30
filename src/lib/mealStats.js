import { toDateString } from './habitLogic'

// ─── Pasti consapevoli ──────────────────────────────────────────────────────
// Trattare il pasto come una "sessione" (start/end, come un allenamento)
// invece di una semplice abitudine da spuntare — richiesta esplicita di
// Flavio per un problema digestivo reale legato al mangiare troppo in fretta.
// mealLog: { [dateStr]: [{id, time, durationMin, level, pts}] }
// level: 1 veloce, 2 normale, 3 con calma — non possiamo rilevare le
// masticazioni senza sensori, quindi è un'autovalutazione subito dopo il
// pasto, sullo stesso principio dello sforzo percepito negli esercizi.

const MEAL_RATE_KEY = 'glp_meal_pts_per_min'
export const DEFAULT_MEAL_RATE = 0.3

export function getMealRate() {
  try {
    const stored = localStorage.getItem(MEAL_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_RATE
  } catch { return DEFAULT_MEAL_RATE }
}

export function setMealRate(rate) {
  try { localStorage.setItem(MEAL_RATE_KEY, String(Math.max(0.01, rate))) } catch { /* ignore */ }
}

export const MEAL_LEVELS = [
  { level: 1, label: 'Veloce', sub: 'da rallentare', emoji: '🔴', multiplier: 0.3 },
  { level: 2, label: 'Normale', sub: 'nella media', emoji: '🟡', multiplier: 0.7 },
  { level: 3, label: 'Con calma', sub: 'masticato bene', emoji: '🟢', multiplier: 1.2 },
]

export function getMealLevelInfo(level) {
  return MEAL_LEVELS.find(l => l.level === level) || MEAL_LEVELS[1]
}

export function computeMealPoints(durationMin, level) {
  const mult = getMealLevelInfo(level).multiplier
  return Math.round(durationMin * getMealRate() * mult * 10) / 10
}

function flattenEntries(mealLog) {
  const entries = []
  Object.entries(mealLog || {}).forEach(([date, sessions]) => {
    (sessions || []).forEach(e => entries.push({ ...e, date }))
  })
  entries.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  return entries
}

export function getMealHistory(mealLog) {
  return flattenEntries(mealLog).reverse()
}

export function computeMealWeekStats(mealLog) {
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const prevWeekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return toDateString(d) })()
  const all = flattenEntries(mealLog)
  const entries = all.filter(e => e.date >= weekCutoff)
  const prevEntries = all.filter(e => e.date >= prevWeekCutoff && e.date < weekCutoff)
  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  const avgDuration = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.durationMin || 0), 0) / entries.length)
    : 0
  const prevAvgDuration = prevEntries.length > 0
    ? Math.round(prevEntries.reduce((s, e) => s + (e.durationMin || 0), 0) / prevEntries.length)
    : 0
  const calmCount = entries.filter(e => e.level === 3).length
  const calmPct = entries.length > 0 ? Math.round((calmCount / entries.length) * 100) : 0
  const longestMeal = all.reduce((max, e) => Math.max(max, e.durationMin || 0), 0)
  return {
    entries, total: entries.length, netPts, avgDuration, calmCount, calmPct,
    lifetimeTotal: all.length, longestMeal,
    durationTrend: (entries.length > 0 && prevEntries.length > 0) ? avgDuration - prevAvgDuration : null,
    ...computeStreak(all),
  }
}

function computeStreak(sortedEntries) {
  const dates = [...new Set(sortedEntries.map(e => e.date))].sort()
  const todayStr = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  const dateSet = new Set(dates)

  let cursor = dateSet.has(todayStr) ? todayStr : (dateSet.has(yesterdayStr) ? yesterdayStr : null)
  let streak = 0
  if (cursor) {
    while (dateSet.has(cursor)) {
      streak++
      // 'T00:00:00' forza il parsing in locale invece che UTC — altrimenti in
      // fusi orari indietro rispetto a UTC (offset negativo) la data risultante
      // sarebbe quella locale del giorno prima (stesso bug che toDateString
      // esiste apposta per evitare, vedi habitLogic.js).
      const d = new Date(cursor + 'T00:00:00'); d.setDate(d.getDate() - 1)
      cursor = toDateString(d)
    }
  }

  // Record storico: la striscia consecutiva più lunga mai fatta, non solo
  // quella attuale — dà un traguardo motivante anche dopo aver saltato dei
  // giorni.
  let bestStreak = 0
  let running = 0
  let prevDate = null
  dates.forEach(dateStr => {
    if (prevDate) {
      const expected = new Date(prevDate + 'T00:00:00'); expected.setDate(expected.getDate() + 1)
      running = (toDateString(expected) === dateStr) ? running + 1 : 1
    } else {
      running = 1
    }
    bestStreak = Math.max(bestStreak, running)
    prevDate = dateStr
  })

  return { streak, bestStreak }
}

// ─── Aforismi ───────────────────────────────────────────────────────────────
// Un promemoria diverso ogni volta che si apre la tab, per rinforzare
// l'obiettivo (mangiare lentamente, masticare) senza diventare ripetitivo.
export const MEAL_QUOTES = [
  'Chi mangia in fretta, mangia due volte: una con la bocca, una con lo stomaco che soffre dopo.',
  'La digestione comincia in bocca: ogni boccone masticato bene è un favore che fai al tuo stomaco.',
  'Posa le posate tra un boccone e l\'altro: il corpo impiega 20 minuti a sentirsi sazio.',
  'Non stai solo mangiando: stai dando al tuo corpo il tempo di dirti quando basta.',
  'Un pasto lento è un pasto che ricordi. Uno veloce è solo carburante ingoiato.',
  'Mastica finché il cibo non ha più forma: è lì che inizia davvero la digestione.',
  'La fretta a tavola si paga dopo, in stomaco pesante. Rallentare oggi è prevenire domani.',
  'Ogni boccone masticato con calma è un piccolo atto di cura verso te stesso.',
  'Non è una gara. Il piatto non scappa.',
  'Respira, posa la forchetta, mastica. Ripeti.',
]

export function getMealQuote() {
  // Cambia ogni volta che l'app viene aperta in un nuovo minuto — stabile
  // durante la sessione ma vario tra un pasto e l'altro, senza dover
  // salvare uno stato dedicato.
  const idx = Math.floor(Date.now() / 60000) % MEAL_QUOTES.length
  return MEAL_QUOTES[idx]
}
