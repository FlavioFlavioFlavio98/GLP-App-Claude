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

function flattenEntries(willpowerLog) {
  const entries = []
  Object.entries(willpowerLog || {}).forEach(([date, sessions]) => {
    (sessions || []).forEach(e => entries.push({ ...e, date }))
  })
  entries.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  return entries
}

// Statistiche su un periodo arbitrario (7 / 30 / 'all') per la pagina di
// statistiche complete — a differenza di computeWillpowerWeekStats che è
// sempre fissa a 7gg per la card compatta.
export function computeWillpowerStats(willpowerLog, days) {
  const all = flattenEntries(willpowerLog)
  let entries = all
  if (days !== 'all') {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - days + 1); return toDateString(d) })()
    entries = all.filter(e => e.date >= cutoff)
  }

  const successCount = entries.filter(e => e.succeeded).length
  const failCount = entries.filter(e => !e.succeeded).length
  const total = entries.length
  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : null

  // Streak di giorni consecutivi con almeno un "l'ho fatto" (nessun fallimento
  // quel giorno) — premia la costanza, non il singolo momento isolato.
  const dayOutcomes = {}
  entries.forEach(e => {
    if (!dayOutcomes[e.date]) dayOutcomes[e.date] = { success: 0, fail: 0 }
    if (e.succeeded) dayOutcomes[e.date].success++
    else dayOutcomes[e.date].fail++
  })
  const cleanDates = Object.keys(dayOutcomes).filter(d => dayOutcomes[d].fail === 0).sort()
  let streak = 0
  if (cleanDates.length > 0) {
    const todayStr = toDateString(new Date())
    const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
    let cursor = cleanDates.includes(todayStr) ? todayStr : (cleanDates.includes(yesterdayStr) ? yesterdayStr : null)
    if (cursor) {
      const set = new Set(cleanDates)
      while (set.has(cursor)) {
        streak++
        const d = new Date(cursor); d.setDate(d.getDate() - 1)
        cursor = toDateString(d)
      }
    }
  }

  return { entries, successCount, failCount, total, netPts, successRate, streak, lifetimeEntries: all.length }
}

// Raggruppa per testo (case/trim-insensitive) — mostra a colpo d'occhio quali
// "cose" si superano di solito e quali no, invece di solo un elenco cronologico.
export function computeWillpowerBreakdown(willpowerLog) {
  const all = flattenEntries(willpowerLog)
  const map = {}
  all.forEach(e => {
    const key = (e.text || '').trim().toLowerCase()
    if (!key) return
    if (!map[key]) map[key] = { label: e.text.trim(), success: 0, fail: 0, netPts: 0 }
    if (e.succeeded) map[key].success++
    else map[key].fail++
    map[key].netPts += parseFloat(e.pts) || 0
  })
  return Object.values(map)
    .map(v => ({ ...v, total: v.success + v.fail, netPts: Math.round(v.netPts * 10) / 10 }))
    .sort((a, b) => b.total - a.total)
}
