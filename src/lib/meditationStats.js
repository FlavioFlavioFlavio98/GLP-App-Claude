import { toDateString } from './habitLogic'

// ─── Meditazione ─────────────────────────────────────────────────────────────
// Log di micro-momenti di meditazione (es. 60 secondi): un tap quando lo fai,
// niente da compilare — a differenza di Willpower non c'è successo/fallimento,
// ogni voce è per definizione un "l'ho fatto". Obiettivo: gamification pura per
// costruire l'abitudine (punti + streak + conteggio settimanale).
// meditationLog: { [dateStr]: [{id, time, pts, minutes}] }
// meditationNotes: { [dateStr]: text } — riflessione libera del giorno, per
// motivarsi rileggendo come ci si è sentiti dopo.

const MEDITATION_RATE_KEY = 'glp_meditation_pts'
export const DEFAULT_MEDITATION_RATE = 1

export function getMeditationRate() {
  try {
    const stored = localStorage.getItem(MEDITATION_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEDITATION_RATE
  } catch { return DEFAULT_MEDITATION_RATE }
}

export function setMeditationRate(rate) {
  try { localStorage.setItem(MEDITATION_RATE_KEY, String(Math.max(0.1, rate))) } catch { /* ignore */ }
}

function flattenEntries(meditationLog) {
  const entries = []
  Object.entries(meditationLog || {}).forEach(([date, sessions]) => {
    (sessions || []).forEach(e => entries.push({ ...e, date }))
  })
  entries.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  return entries
}

// Storico sessioni per la UI, più recenti prima — così si vede a colpo
// d'occhio l'ultima aggiunta senza scorrere fino in fondo.
export function getMeditationHistory(meditationLog) {
  return flattenEntries(meditationLog).reverse()
}

// Statistiche sugli ultimi 7 giorni (rolling) per la card compatta.
export function computeMeditationWeekStats(meditationLog) {
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const all = flattenEntries(meditationLog)
  const entries = all.filter(e => e.date >= weekCutoff)
  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  return { entries, total: entries.length, netPts, lifetimeTotal: all.length, ...computeStreak(all) }
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
