import { toDateString } from './habitLogic'

// ─── Willpower ────────────────────────────────────────────────────────────────
// Log rapido di "cose che non avevo voglia di fare" — fatte (+pt) o non fatte
// (-pt), stessa magnitudine in entrambi i casi (configurabile). L'obiettivo non
// è tracciare l'azione in sé (niente durata/reps) ma il momento di resistenza:
// l'ho superato o no. willpowerLog: { [dateStr]: [{id, text, succeeded, pts, time}] }

const WILLPOWER_RATE_KEY = 'glp_willpower_pts'
export const DEFAULT_WILLPOWER_RATE = 3

export function getWillpowerRate() {
  try {
    const stored = localStorage.getItem(WILLPOWER_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_WILLPOWER_RATE
  } catch { return DEFAULT_WILLPOWER_RATE }
}

export function setWillpowerRate(rate) {
  try { localStorage.setItem(WILLPOWER_RATE_KEY, String(Math.max(0.1, rate))) } catch { /* ignore */ }
}

// Statistiche sugli ultimi 7 giorni (rolling), non sulla settimana di calendario —
// così "a fine settimana" funziona indipendentemente da quando la guardi.
export function computeWillpowerWeekStats(willpowerLog) {
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const dates = Object.keys(willpowerLog || {}).filter(d => d >= weekCutoff).sort()

  const entries = []
  dates.forEach(d => {
    (willpowerLog[d] || []).forEach(e => entries.push({ ...e, date: d }))
  })
  entries.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))

  const successCount = entries.filter(e => e.succeeded).length
  const failCount = entries.filter(e => !e.succeeded).length
  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10

  return { entries, successCount, failCount, netPts, total: entries.length }
}
