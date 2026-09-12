import { toDateString } from './habitLogic'

// ─── Statistiche Diario ─────────────────────────────────────────────────────
// Streak e totali per la tab Diario, richiesti esplicitamente da Flavio per
// coerenza con le altre tab (Aree della vita, Abitudini, Pasti hanno tutte
// streak + statistiche lifetime). Stesso identico algoritmo di streak già
// usato in lifeAreaStats.js/workoutStats.js — duplicato qui invece che
// condiviso, stessa scelta già fatta altrove nel progetto per queste
// funzioni brevi e specifiche del dominio.

function hasEntry(diaryLog, dateStr) {
  return Boolean((diaryLog || {})[dateStr]?.text?.trim())
}

export function computeDiaryStreak(diaryLog) {
  const dates = Object.keys(diaryLog || {}).filter(d => hasEntry(diaryLog, d)).sort()
  const todayStr = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  const dateSet = new Set(dates)

  let cursor = dateSet.has(todayStr) ? todayStr : (dateSet.has(yesterdayStr) ? yesterdayStr : null)
  let streak = 0
  if (cursor) {
    while (dateSet.has(cursor)) {
      streak++
      const d = new Date(cursor + 'T00:00:00'); d.setDate(d.getDate() - 1)
      cursor = toDateString(d)
    }
  }

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

export function computeDiaryStats(diaryLog) {
  const entries = Object.entries(diaryLog || {}).filter(([, e]) => e?.text?.trim())
  const lifetimeDays = entries.length
  const lifetimeWords = entries.reduce((sum, [, e]) => sum + (e.wordCount || 0), 0)
  const lifetimeSeconds = entries.reduce((sum, [, e]) => sum + (e.timeSpentSec || 0), 0)

  let bestDay = null
  entries.forEach(([date, e]) => {
    if (!bestDay || (e.wordCount || 0) > bestDay.wordCount) bestDay = { date, wordCount: e.wordCount || 0 }
  })

  const { streak, bestStreak } = computeDiaryStreak(diaryLog)
  return { streak, bestStreak, lifetimeDays, lifetimeWords, lifetimeSeconds, bestDay }
}
