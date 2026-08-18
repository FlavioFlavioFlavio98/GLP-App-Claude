import { toDateString } from './habitLogic'

// ─── Barefoot ───────────────────────────────────────────────────────────────
// Stesso pattern di mobilityLog (workoutStats.js): sessioni con durata in
// minuti, punteggio = durata × tasso. Tasso locale (localStorage), non un
// dato per-esercizio su Firestore.

const BAREFOOT_RATE_KEY = 'glp_barefoot_pts_per_min'
export const DEFAULT_BAREFOOT_RATE = 0.1

export function getBarefootRate() {
  try {
    const stored = localStorage.getItem(BAREFOOT_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_BAREFOOT_RATE
  } catch { return DEFAULT_BAREFOOT_RATE }
}

export function setBarefootRate(rate) {
  try { localStorage.setItem(BAREFOOT_RATE_KEY, String(Math.max(0.01, rate))) } catch { /* ignore */ }
}

export function getDayBarefootEffort(barefootLog, dateStr) {
  const total = (barefootLog?.[dateStr] || []).reduce((sum, s) => sum + (parseFloat(s.pts) || 0), 0)
  return Math.round(total * 100) / 100
}

export function computeBarefootStreak(barefootLog) {
  const dates = Object.keys(barefootLog || {})
    .filter(d => getDayBarefootEffort(barefootLog, d) > 0)
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

export function computeBarefootStats(barefootLog) {
  const todayStr = toDateString(new Date())
  const allDates = Object.keys(barefootLog || {})

  function minutesOnDate(d) {
    return (barefootLog?.[d] || []).reduce((a, s) => a + (parseFloat(s.duration) || 0), 0)
  }

  const todayMinutes = minutesOnDate(todayStr)
  const todayPts = getDayBarefootEffort(barefootLog, todayStr)

  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const weekMinutes = allDates.filter(d => d >= weekCutoff).reduce((a, d) => a + minutesOnDate(d), 0)

  const lifetimeMinutes = allDates.reduce((a, d) => a + minutesOnDate(d), 0)
  const lifetimePts = Math.round(allDates.reduce((a, d) => a + getDayBarefootEffort(barefootLog, d), 0) * 10) / 10

  const streak = computeBarefootStreak(barefootLog)

  return { todayMinutes, todayPts, weekMinutes, lifetimeMinutes, lifetimePts, streak }
}

// ─── Hang ───────────────────────────────────────────────────────────────────
// Sospensioni alla sbarra — stesso pattern di Barefoot/Mobility, solo tasso
// di default molto più alto (sforzo per minuto ben maggiore).

const HANG_RATE_KEY = 'glp_hang_pts_per_min'
export const DEFAULT_HANG_RATE = 3

export function getHangRate() {
  try {
    const stored = localStorage.getItem(HANG_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_HANG_RATE
  } catch { return DEFAULT_HANG_RATE }
}

export function setHangRate(rate) {
  try { localStorage.setItem(HANG_RATE_KEY, String(Math.max(0.01, rate))) } catch { /* ignore */ }
}

export function getDayHangEffort(hangLog, dateStr) {
  const total = (hangLog?.[dateStr] || []).reduce((sum, s) => sum + (parseFloat(s.pts) || 0), 0)
  return Math.round(total * 100) / 100
}

export function computeHangStreak(hangLog) {
  const dates = Object.keys(hangLog || {})
    .filter(d => getDayHangEffort(hangLog, d) > 0)
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

export function computeHangStats(hangLog) {
  const todayStr = toDateString(new Date())
  const allDates = Object.keys(hangLog || {})

  function minutesOnDate(d) {
    return (hangLog?.[d] || []).reduce((a, s) => a + (parseFloat(s.duration) || 0), 0)
  }

  const todayMinutes = minutesOnDate(todayStr)
  const todayPts = getDayHangEffort(hangLog, todayStr)

  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const weekMinutes = allDates.filter(d => d >= weekCutoff).reduce((a, d) => a + minutesOnDate(d), 0)

  const lifetimeMinutes = allDates.reduce((a, d) => a + minutesOnDate(d), 0)
  const lifetimePts = Math.round(allDates.reduce((a, d) => a + getDayHangEffort(hangLog, d), 0) * 10) / 10

  const streak = computeHangStreak(hangLog)

  return { todayMinutes, todayPts, weekMinutes, lifetimeMinutes, lifetimePts, streak }
}

// ─── Sun Exposure ───────────────────────────────────────────────────────────
// Non è un log di sessioni ma un valore per giorno: livello (basso/medio/alto)
// per mattina e sera separatamente. Nessun punteggio per ora — solo tracciamento.

export const SUN_LEVELS = [
  { value: 'basso', label: 'Basso', emoji: '🌤️' },
  { value: 'medio', label: 'Medio', emoji: '⛅' },
  { value: 'alto',  label: 'Alto',  emoji: '☀️' },
]

export function getSunExposureForDate(sunExposureLog, dateStr) {
  return sunExposureLog?.[dateStr] || { morning: null, evening: null }
}

// Giorni con almeno un valore (mattina o sera) impostato, negli ultimi N giorni
export function countSunExposureDays(sunExposureLog, days = 7) {
  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return toDateString(d) })()
  return Object.entries(sunExposureLog || {})
    .filter(([d, v]) => d >= cutoff && (v?.morning || v?.evening))
    .length
}
