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
  const all = flattenEntries(mealLog)
  const entries = all.filter(e => e.date >= weekCutoff)
  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  const avgDuration = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.durationMin || 0), 0) / entries.length)
    : 0
  const calmCount = entries.filter(e => e.level === 3).length
  return { entries, total: entries.length, netPts, avgDuration, calmCount, lifetimeTotal: all.length, ...computeStreak(all) }
}

function computeStreak(sortedEntries) {
  const dates = new Set(sortedEntries.map(e => e.date))
  const todayStr = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  let cursor = dates.has(todayStr) ? todayStr : (dates.has(yesterdayStr) ? yesterdayStr : null)
  let streak = 0
  if (cursor) {
    while (dates.has(cursor)) {
      streak++
      const d = new Date(cursor); d.setDate(d.getDate() - 1)
      cursor = toDateString(d)
    }
  }
  return { streak }
}
