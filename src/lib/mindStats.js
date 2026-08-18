import { toDateString } from './habitLogic'

// ─── YouTube & Social ────────────────────────────────────────────────────────
// Una voce al giorno (non sessioni multiple), inserita la sera: hai aperto
// YouTube/Social per la prima volta dopo mezzogiorno? quanti minuti in totale?
// Bonus fisso se sì, ridotto in base ai minuti usati (più stai, meno guadagni).
// Se aperto prima di mezzogiorno: zero punti, qualunque sia la durata.

const AFTERNOON_BONUS_KEY = 'glp_social_afternoon_bonus'
const DURATION_PENALTY_KEY = 'glp_social_duration_penalty'
export const DEFAULT_AFTERNOON_BONUS = 5
export const DEFAULT_DURATION_PENALTY = 0.1

export function getAfternoonBonus() {
  try {
    const stored = localStorage.getItem(AFTERNOON_BONUS_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_AFTERNOON_BONUS
  } catch { return DEFAULT_AFTERNOON_BONUS }
}
export function setAfternoonBonus(v) {
  try { localStorage.setItem(AFTERNOON_BONUS_KEY, String(Math.max(0.1, v))) } catch { /* ignore */ }
}

export function getDurationPenalty() {
  try {
    const stored = localStorage.getItem(DURATION_PENALTY_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_DURATION_PENALTY
  } catch { return DEFAULT_DURATION_PENALTY }
}
export function setDurationPenalty(v) {
  try { localStorage.setItem(DURATION_PENALTY_KEY, String(Math.max(0.01, v))) } catch { /* ignore */ }
}

export function computeSocialPts(afterNoon, minutes) {
  if (!afterNoon) return 0
  const pts = getAfternoonBonus() - (parseFloat(minutes) || 0) * getDurationPenalty()
  return Math.max(0, Math.round(pts * 100) / 100)
}

export function getSocialEntryForDate(mindSocialLog, dateStr) {
  return mindSocialLog?.[dateStr] || null
}

// Streak sui giorni in cui il social è stato aperto dopo mezzogiorno
export function computeSocialStreak(mindSocialLog) {
  const dates = Object.keys(mindSocialLog || {})
    .filter(d => mindSocialLog[d]?.afterNoon)
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

export function computeSocialStats(mindSocialLog) {
  const allDates = Object.keys(mindSocialLog || {})
  const trackedDays = allDates.length
  const afterNoonDays = allDates.filter(d => mindSocialLog[d]?.afterNoon).length

  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const weekEntries = allDates.filter(d => d >= weekCutoff)
  const weekAvgMinutes = weekEntries.length > 0
    ? Math.round(weekEntries.reduce((a, d) => a + (parseFloat(mindSocialLog[d]?.minutes) || 0), 0) / weekEntries.length)
    : 0

  const lifetimePts = Math.round(allDates.reduce((a, d) => a + (parseFloat(mindSocialLog[d]?.pts) || 0), 0) * 10) / 10

  const streak = computeSocialStreak(mindSocialLog)

  return { trackedDays, afterNoonDays, weekAvgMinutes, lifetimePts, streak }
}
