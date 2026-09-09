import { toDateString } from './habitLogic'

// ─── Aree della vita ────────────────────────────────────────────────────────
// Tempo dedicato a migliorare aspetti della vita (salute mentale, salute
// fisica, relazioni, ecc.) che non sono abitudini ripetute né allenamento —
// leggere un libro, fare una telefonata con intenzione, ecc. Richiesta
// esplicita di Flavio: vuole vedere il tempo investito in crescita personale
// aumentare nel tempo, diviso per area, non solo un numero unico.
// lifeAreaLog: { [dateStr]: [{id, areaId, duration, note, pts, time, source}] }
// source: 'timer' | 'manual' — distingue in UI una sessione cronometrata da
// un inserimento a mano, stesso principio di "untracked" in mealStats.js.

const LIFEAREA_RATE_KEY = 'glp_lifearea_pts_per_min'
export const DEFAULT_LIFEAREA_RATE = 0.5

export function getLifeAreaRate() {
  try {
    const stored = localStorage.getItem(LIFEAREA_RATE_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_LIFEAREA_RATE
  } catch { return DEFAULT_LIFEAREA_RATE }
}

export function setLifeAreaRate(rate) {
  try { localStorage.setItem(LIFEAREA_RATE_KEY, String(Math.max(0.1, rate))) } catch { /* ignore */ }
}

// Isolata in una sola funzione (non ricalcolata separatamente in store.jsx e
// nel timer in UI): usata sia per il salvataggio reale sia per l'anteprima
// "+X pt" live durante la sessione, altrimenti le due formule rischierebbero
// di disallinearsi a un futuro cambio del tasso.
export function computeLifeAreaPoints(durationMin) {
  return Math.round(durationMin * getLifeAreaRate() * 100) / 100
}

function dayEntries(lifeAreaLog, dateStr, areaId) {
  const entries = (lifeAreaLog || {})[dateStr] || []
  return areaId ? entries.filter(e => e.areaId === areaId) : entries
}

export function getDayLifeAreaEffort(lifeAreaLog, dateStr, areaId = null) {
  const total = dayEntries(lifeAreaLog, dateStr, areaId).reduce((sum, e) => sum + (parseFloat(e.pts) || 0), 0)
  return Math.round(total * 100) / 100
}

function getDayLifeAreaMinutes(lifeAreaLog, dateStr, areaId = null) {
  return dayEntries(lifeAreaLog, dateStr, areaId).reduce((sum, e) => sum + (e.duration || 0), 0)
}

// Giorni consecutivi (fino a oggi o ieri) in cui è stata loggata almeno una
// sessione — areaId=null vale "qualsiasi area", stesso identico algoritmo di
// computeStudyStreak in workoutStats.js.
export function computeLifeAreaStreak(lifeAreaLog, areaId = null) {
  const dates = Object.keys(lifeAreaLog || {})
    .filter(d => getDayLifeAreaEffort(lifeAreaLog, d, areaId) > 0)
    .sort()
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

// Minuti totali per giorno negli ultimi N giorni (dal più vecchio al più
// recente) — per il grafico a barre "andamento", filtrabile per area.
export function computeLifeAreaDailyTotals(lifeAreaLog, days = 14, areaId = null) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = toDateString(d)
    result.push({
      date: dateStr,
      totalMin: getDayLifeAreaMinutes(lifeAreaLog, dateStr, areaId),
      count: dayEntries(lifeAreaLog, dateStr, areaId).length,
    })
  }
  return result
}

// Ultima data con almeno una sessione per l'area (null se mai loggata) — usata
// sia per l'avviso "area ferma da Xg" sia per ordinare le card mettendo prima
// quella più trascurata, così la tab spinge a riequilibrare invece di limitarsi
// a registrare a posteriori.
function lastSessionDate(lifeAreaLog, areaId) {
  const dates = Object.keys(lifeAreaLog || {})
    .filter(d => getDayLifeAreaEffort(lifeAreaLog, d, areaId) > 0)
    .sort()
  return dates.length > 0 ? dates[dates.length - 1] : null
}

function daysBetween(fromDateStr, toDateStr) {
  const a = new Date(fromDateStr + 'T00:00:00')
  const b = new Date(toDateStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

function flattenEntries(lifeAreaLog) {
  const entries = []
  Object.entries(lifeAreaLog || {}).forEach(([date, sessions]) => {
    (sessions || []).forEach(e => entries.push({ ...e, date }))
  })
  return entries
}

// Note libere del "Diario" per area — stessa forma per-data di lifeAreaLog
// (lifeAreaNotes: {dateStr: [{id, areaId, text, time}]}), ma senza durata/pt:
// qui l'obiettivo è solo tenere traccia di cosa si è fatto, in parole proprie.
// areaId=null restituisce le note di tutte le aree (non usato oggi, ma
// coerente con getDayLifeAreaEffort qui sopra).
export function getLifeAreaNotes(lifeAreaNotes, areaId = null) {
  const entries = []
  Object.entries(lifeAreaNotes || {}).forEach(([date, notes]) => {
    (notes || []).forEach(n => {
      if (!areaId || n.areaId === areaId) entries.push({ ...n, date })
    })
  })
  return entries.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
}

// Aggregato principale, consumato dalla Tab e dal modal statistiche: totali
// generali più il breakdown per-area (il requisito distintivo di questa
// feature rispetto a studyLog/mealLog, che hanno un solo "argomento").
export function computeLifeAreaStats(lifeAreaLog, lifeAreas) {
  const todayStr = toDateString(new Date())
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const prevWeekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return toDateString(d) })()

  const all = flattenEntries(lifeAreaLog)
  const weekEntries = all.filter(e => e.date >= weekCutoff)
  const prevWeekEntries = all.filter(e => e.date >= prevWeekCutoff && e.date < weekCutoff)

  const sum = (list, key) => list.reduce((s, e) => s + (parseFloat(e[key]) || 0), 0)

  const todayMinutes = getDayLifeAreaMinutes(lifeAreaLog, todayStr)
  const todayPts = getDayLifeAreaEffort(lifeAreaLog, todayStr)
  const weekMinutes = sum(weekEntries, 'duration')
  const prevWeekMinutes = sum(prevWeekEntries, 'duration')
  const lifetimeMinutes = sum(all, 'duration')
  const lifetimePts = Math.round(sum(all, 'pts') * 100) / 100

  const areas = lifeAreas || []
  const byArea = areas
    .filter(a => a.active !== false)
    .map(a => {
      const areaWeekEntries = weekEntries.filter(e => e.areaId === a.id)
      const areaAll = all.filter(e => e.areaId === a.id)
      const weekMin = sum(areaWeekEntries, 'duration')
      const lastDate = lastSessionDate(lifeAreaLog, a.id)
      const weeklyTargetMin = a.weeklyTargetMin || 0
      return {
        areaId: a.id,
        name: a.name,
        emoji: a.emoji,
        color: a.color,
        todayMin: getDayLifeAreaMinutes(lifeAreaLog, todayStr, a.id),
        weekMin,
        weekPts: Math.round(sum(areaWeekEntries, 'pts') * 100) / 100,
        lifetimeMin: sum(areaAll, 'duration'),
        lifetimePts: Math.round(sum(areaAll, 'pts') * 100) / 100,
        sessionCount: areaAll.length,
        ...computeLifeAreaStreak(lifeAreaLog, a.id),
        pctOfWeekTotal: weekMinutes > 0 ? Math.round((weekMin / weekMinutes) * 100) : 0,
        weeklyTargetMin,
        weekTargetPct: weeklyTargetMin > 0 ? Math.round((weekMin / weeklyTargetMin) * 100) : null,
        lastSessionDate: lastDate,
        daysSinceLastSession: lastDate ? daysBetween(lastDate, todayStr) : null,
      }
    })

  return {
    todayMinutes, todayPts, weekMinutes, prevWeekMinutes,
    weekTrend: prevWeekMinutes > 0 ? weekMinutes - prevWeekMinutes : null,
    lifetimeMinutes, lifetimePts,
    sessionCount: all.length,
    ...computeLifeAreaStreak(lifeAreaLog),
    byArea,
    dailyTotals: computeLifeAreaDailyTotals(lifeAreaLog, 14),
  }
}
