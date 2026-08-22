import { toDateString } from './habitLogic'

// ─── Riepilogo Giornata ─────────────────────────────────────────────────────
// Trascrizione vocale libera → riepilogo AI a categorie fisse (vedi
// generateDayRecap in functions/index.js). dayRecapLog: { [dateStr]: {
//   categories: [{key,label,emoji,items}], transcript, pts, createdAt } }
// I punti si guadagnano una sola volta per giorno (alla prima generazione),
// rigenerare lo stesso giorno non ne dà altri.

const DAY_RECAP_RATE_KEY = 'glp_day_recap_pts'
export const DEFAULT_DAY_RECAP_RATE = 5

export function getDayRecapRate() {
  try {
    const stored = localStorage.getItem(DAY_RECAP_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_DAY_RECAP_RATE
  } catch { return DEFAULT_DAY_RECAP_RATE }
}

export function setDayRecapRate(rate) {
  try { localStorage.setItem(DAY_RECAP_RATE_KEY, String(Math.max(0.1, rate))) } catch { /* ignore */ }
}

export function computeDayRecapStreak(dayRecapLog) {
  const dates = Object.keys(dayRecapLog || {}).sort()
  if (!dates.length) return { current: 0, best: 0 }

  const runs = []
  let runStart = dates[0], runLen = 1
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000)
    if (diff === 1) { runLen++ }
    else { runs.push({ len: runLen }); runStart = dates[i]; runLen = 1 }
  }
  runs.push({ len: runLen })

  const best = Math.max(...runs.map(r => r.len))
  const todayStr = toDateString(new Date())
  const yesterdayStr = toDateString(new Date(Date.now() - 86400000))
  const last = dates.at(-1)
  const current = (last === todayStr || last === yesterdayStr) ? runs.at(-1).len : 0

  return { current, best }
}
