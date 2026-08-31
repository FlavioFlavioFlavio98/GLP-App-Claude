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

// ─── Pasti non tracciati (penalità) ─────────────────────────────────────────
// Registrare un pasto mangiato ma non cronometrato costa punti — l'obiettivo
// è disincentivare i "buchi" nel tracking (richiesta esplicita di Flavio: "mi
// motiva a tracciare tutto"), non punire l'aver mangiato in fretta quel
// pasto (che non sappiamo, non essendo stato cronometrato).
const MEAL_UNTRACKED_PENALTY_KEY = 'glp_meal_untracked_penalty'
export const DEFAULT_MEAL_UNTRACKED_PENALTY = 2

export function getUntrackedMealPenalty() {
  try {
    const stored = localStorage.getItem(MEAL_UNTRACKED_PENALTY_KEY)
    const n = parseFloat(stored)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_UNTRACKED_PENALTY
  } catch { return DEFAULT_MEAL_UNTRACKED_PENALTY }
}

export function setUntrackedMealPenalty(value) {
  try { localStorage.setItem(MEAL_UNTRACKED_PENALTY_KEY, String(Math.max(0.1, value))) } catch { /* ignore */ }
}

// ─── Obiettivo di durata ────────────────────────────────────────────────────
// Impostato prima di iniziare il pasto per dare un traguardo concreto durante
// la sessione ("tieni duro altri 4 minuti") invece di un timer che sale e
// basta — richiesta esplicita di Flavio. Ricordato in locale (non per-pasto)
// così il prossimo pasto riparte già con l'ultimo obiettivo scelto.
const MEAL_TARGET_KEY = 'glp_meal_target_min'
export const DEFAULT_MEAL_TARGET = 15
export const MEAL_TARGET_OPTIONS = [10, 15, 20, 25, 30]

export function getMealTarget() {
  try {
    const stored = localStorage.getItem(MEAL_TARGET_KEY)
    const n = parseInt(stored, 10)
    return (!isNaN(n) && n > 0) ? n : DEFAULT_MEAL_TARGET
  } catch { return DEFAULT_MEAL_TARGET }
}

export function setMealTarget(minutes) {
  try { localStorage.setItem(MEAL_TARGET_KEY, String(Math.max(1, Math.round(minutes)))) } catch { /* ignore */ }
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

// Totale minuti mangiati per giorno (somma di tutti i pasti di quel giorno,
// non la media) per gli ultimi N giorni, dal più vecchio al più recente —
// l'unico numero che conta per l'obiettivo di Flavio: "voglio aumentare quel
// tempo", non il numero di pasti o la durata media di uno solo.
export function computeDailyTotals(mealLog, days = 14) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = toDateString(d)
    // Solo i pasti realmente cronometrati hanno una durata — quelli non
    // tracciati non hanno un tempo da sommare (è proprio il punto: non
    // sappiamo quanto sono durati, altrimenti sarebbero stati tracciati).
    const dayEntries = (mealLog[dateStr] || []).filter(e => !e.untracked)
    result.push({
      date: dateStr,
      totalMin: dayEntries.reduce((s, e) => s + (e.durationMin || 0), 0),
      count: dayEntries.length,
    })
  }
  return result
}

export function computeMealWeekStats(mealLog) {
  const todayStr = toDateString(new Date())
  const weekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toDateString(d) })()
  const prevWeekCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return toDateString(d) })()
  const all = flattenEntries(mealLog)
  const entries = all.filter(e => e.date >= weekCutoff)
  const prevEntries = all.filter(e => e.date >= prevWeekCutoff && e.date < weekCutoff)

  // Le metriche di qualità (durata, calma, streak) contano solo i pasti
  // realmente cronometrati — un pasto "non tracciato" non è un pasto veloce,
  // è un pasto di cui semplicemente non sappiamo nulla, includerlo
  // diluirebbe queste statistiche in modo scorretto. Conta invece per il
  // totale punti (la penalità) e per le statistiche di copertura qui sotto.
  const trackedAll = all.filter(e => !e.untracked)
  const trackedEntries = entries.filter(e => !e.untracked)
  const trackedPrevEntries = prevEntries.filter(e => !e.untracked)

  const netPts = Math.round(entries.reduce((s, e) => s + (parseFloat(e.pts) || 0), 0) * 10) / 10
  const avgDuration = trackedEntries.length > 0
    ? Math.round(trackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0) / trackedEntries.length)
    : 0
  const prevAvgDuration = trackedPrevEntries.length > 0
    ? Math.round(trackedPrevEntries.reduce((s, e) => s + (e.durationMin || 0), 0) / trackedPrevEntries.length)
    : 0
  const calmCount = trackedEntries.filter(e => e.level === 3).length
  const calmPct = trackedEntries.length > 0 ? Math.round((calmCount / trackedEntries.length) * 100) : 0
  const longestMeal = trackedAll.reduce((max, e) => Math.max(max, e.durationMin || 0), 0)

  // Tempo totale oggi (somma pasti tracciati di oggi) e trend settimanale
  // dello stesso aggregato — il numero che Flavio vuole vedere salire nel
  // tempo.
  const todayEntries = all.filter(e => e.date === todayStr)
  const todayTrackedEntries = todayEntries.filter(e => !e.untracked)
  const todayTotalMin = todayTrackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const todayUntrackedCount = todayEntries.filter(e => e.untracked).reduce((s, e) => s + (e.count || 1), 0)
  const weekTotalMin = trackedEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const prevWeekTotalMin = trackedPrevEntries.reduce((s, e) => s + (e.durationMin || 0), 0)
  const targetHits = trackedEntries.filter(e => e.target && e.durationMin >= e.target).length
  const targetedEntries = trackedEntries.filter(e => e.target).length

  // Copertura del tracking: quanti pasti su tutti quelli registrati (tracciati
  // + non tracciati) sono stati effettivamente cronometrati — il numero che
  // rende visibile se ti stai "dimenticando" spesso.
  const untrackedCount7d = entries.filter(e => e.untracked).reduce((s, e) => s + (e.count || 1), 0)
  const trackedCount7d = trackedEntries.length
  const trackingCoveragePct = (trackedCount7d + untrackedCount7d) > 0
    ? Math.round((trackedCount7d / (trackedCount7d + untrackedCount7d)) * 100)
    : null

  return {
    entries, netPts, avgDuration, calmCount, calmPct,
    lifetimeTotal: trackedAll.length, longestMeal,
    durationTrend: (trackedEntries.length > 0 && trackedPrevEntries.length > 0) ? avgDuration - prevAvgDuration : null,
    todayTotalMin, todayMealCount: todayTrackedEntries.length, todayUntrackedCount,
    weekTotalTrend: prevWeekTotalMin > 0 ? weekTotalMin - prevWeekTotalMin : null,
    targetHitPct: targetedEntries > 0 ? Math.round((targetHits / targetedEntries) * 100) : null,
    untrackedCount7d, trackingCoveragePct,
    dailyTotals: computeDailyTotals(mealLog, 14),
    ...computeStreak(trackedAll),
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

// ─── Trick durante il pasto ─────────────────────────────────────────────────
// Mostrati a rotazione insieme al richiamo periodico, azioni concrete da
// fare subito (non massime generiche come le citazioni sopra) — richiesta
// esplicita: "posa la posata, respira, odora e guarda il cibo".
export const EATING_TIPS = [
  { emoji: '🍴', text: 'Posa le posate tra un boccone e l\'altro' },
  { emoji: '🌬️', text: 'Fai un respiro profondo prima del prossimo boccone' },
  { emoji: '👃', text: 'Odora il cibo prima di assaggiarlo' },
  { emoji: '👀', text: 'Guarda bene cosa stai per mangiare, non lo schermo' },
  { emoji: '🦷', text: 'Mastica finché il boccone non ha più consistenza' },
  { emoji: '💧', text: 'Fai una piccola pausa e bevi un sorso d\'acqua' },
  { emoji: '👅', text: 'Nota il sapore: dolce, salato, amaro, acido?' },
  { emoji: '🤔', text: 'Chiediti: ho ancora davvero fame?' },
  { emoji: '🐢', text: 'Rallenta il ritmo delle posate della metà' },
  { emoji: '🧘', text: 'Rilassa le spalle e siediti bene composto' },
]

export function getEatingTip(index) {
  return EATING_TIPS[((index % EATING_TIPS.length) + EATING_TIPS.length) % EATING_TIPS.length]
}
