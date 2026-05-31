import { parseEntry, toDateString, getItemValueAtDate } from './habitLogic'

// ─── Achievement Definitions ──────────────────────────────────────────────────

export const ACHIEVEMENT_CATS = {
  start: 'Primi Passi',
  streak: 'Streak',
  score: 'Punteggio',
  habits: 'Abitudini',
  shop: 'Negozio',
  special: 'Speciali',
}

export const ACHIEVEMENT_DEFS = [
  // ── Primi Passi ──────────────────────────────────────────────────────────────
  { id: 'first_habit', icon: '🌱', name: 'Primo passo', cat: 'start',
    desc: 'Completa la prima abitudine in assoluto',
    check: (ud) => _totalDone(ud) >= 1,
    progress: (ud) => ({ current: Math.min(_totalDone(ud), 1), target: 1 }) },

  { id: 'streak_3_early', icon: '🔥', name: 'Tre giorni di fila', cat: 'start',
    desc: 'Raggiungi una streak di 3 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 3,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 3), target: 3 }) },

  { id: 'week_first', icon: '⭐', name: 'Prima settimana', cat: 'start',
    desc: '7 giorni consecutivi con almeno un\'abitudine completata',
    check: (ud, ex) => (ex.currentStreak || 0) >= 7,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 7), target: 7 }) },

  { id: 'score_100', icon: '💪', name: '100 punti', cat: 'start',
    desc: 'Raggiungi 100 punti totali',
    check: (ud) => (ud?.score || 0) >= 100,
    progress: (ud) => ({ current: Math.min(ud?.score || 0, 100), target: 100 }) },

  // ── Streak ───────────────────────────────────────────────────────────────────
  { id: 'streak_7', icon: '🔥', name: 'Settimana di fuoco', cat: 'streak',
    desc: 'Streak di 7 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 7,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 7), target: 7 }) },

  { id: 'streak_14', icon: '💫', name: 'Due settimane', cat: 'streak',
    desc: 'Streak di 14 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 14,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 14), target: 14 }) },

  { id: 'streak_30', icon: '🏆', name: 'Un mese', cat: 'streak',
    desc: 'Streak di 30 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 30,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 30), target: 30 }) },

  { id: 'streak_90', icon: '👑', name: 'Tre mesi', cat: 'streak',
    desc: 'Streak di 90 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 90,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 90), target: 90 }) },

  { id: 'streak_180', icon: '🌟', name: 'Sei mesi', cat: 'streak',
    desc: 'Streak di 180 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 180,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 180), target: 180 }) },

  { id: 'streak_365', icon: '🔱', name: 'Un anno', cat: 'streak',
    desc: 'Streak di 365 giorni',
    check: (ud, ex) => (ex.currentStreak || 0) >= 365,
    progress: (ud, ex) => ({ current: Math.min(ex.currentStreak || 0, 365), target: 365 }) },

  // ── Punteggio ────────────────────────────────────────────────────────────────
  { id: 'score_1000', icon: '💰', name: 'Mille punti', cat: 'score',
    desc: 'Raggiungi 1.000 punti totali',
    check: (ud) => (ud?.score || 0) >= 1000,
    progress: (ud) => ({ current: Math.min(ud?.score || 0, 1000), target: 1000 }) },

  { id: 'score_10000', icon: '💎', name: 'Diecimila', cat: 'score',
    desc: 'Raggiungi 10.000 punti totali',
    check: (ud) => (ud?.score || 0) >= 10000,
    progress: (ud) => ({ current: Math.min(ud?.score || 0, 10000), target: 10000 }) },

  { id: 'score_50000', icon: '🏅', name: 'Cinquantamila', cat: 'score',
    desc: 'Raggiungi 50.000 punti totali',
    check: (ud) => (ud?.score || 0) >= 50000,
    progress: (ud) => ({ current: Math.min(ud?.score || 0, 50000), target: 50000 }) },

  { id: 'score_100000', icon: '👑', name: 'Centomila', cat: 'score',
    desc: 'Raggiungi 100.000 punti totali',
    check: (ud) => (ud?.score || 0) >= 100000,
    progress: (ud) => ({ current: Math.min(ud?.score || 0, 100000), target: 100000 }) },

  // ── Abitudini ────────────────────────────────────────────────────────────────
  { id: 'habit_30_same', icon: '📅', name: 'Costante', cat: 'habits',
    desc: 'Completa la stessa abitudine per 30 giorni',
    check: (ud) => _maxSingleHabitDone(ud) >= 30,
    progress: (ud) => ({ current: Math.min(_maxSingleHabitDone(ud), 30), target: 30 }) },

  { id: 'perfect_day', icon: '🎯', name: 'Perfezionista', cat: 'habits',
    desc: 'Completa tutte le abitudini in un giorno',
    check: (ud) => _hasPerfectDay(ud),
    progress: () => null },

  { id: 'balanced_day', icon: '🌈', name: 'Equilibrio', cat: 'habits',
    desc: 'Completa almeno un\'abitudine per ogni categoria in un giorno',
    check: (ud) => _hasBalancedDay(ud),
    progress: () => null },

  { id: 'habit_100_times', icon: '💯', name: 'Cento giorni', cat: 'habits',
    desc: 'Completa un\'abitudine 100 volte in totale',
    check: (ud) => _maxSingleHabitDone(ud) >= 100,
    progress: (ud) => ({ current: Math.min(_maxSingleHabitDone(ud), 100), target: 100 }) },

  { id: 'no_penalty_7', icon: '🛡️', name: 'Indistruttibile', cat: 'habits',
    desc: 'Nessuna penalità per 7 giorni consecutivi',
    check: (ud) => _noPenaltyStreak(ud) >= 7,
    progress: (ud) => ({ current: Math.min(_noPenaltyStreak(ud), 7), target: 7 }) },

  // ── Negozio ──────────────────────────────────────────────────────────────────
  { id: 'first_purchase', icon: '🛍️', name: 'Primo acquisto', cat: 'shop',
    desc: 'Acquista il primo premio',
    check: (ud) => _totalPurchases(ud) >= 1,
    progress: () => null },

  { id: 'collector_10', icon: '🎁', name: 'Collezionista', cat: 'shop',
    desc: 'Acquista 10 premi in totale',
    check: (ud) => _totalPurchases(ud) >= 10,
    progress: (ud) => ({ current: Math.min(_totalPurchases(ud), 10), target: 10 }) },

  { id: 'big_spend_500', icon: '💸', name: 'Grande spesa', cat: 'shop',
    desc: 'Spendi 500 punti in un solo acquisto',
    check: (ud) => _maxSinglePurchase(ud) >= 500,
    progress: (ud) => ({ current: Math.min(_maxSinglePurchase(ud), 500), target: 500 }) },

  // ── Speciali ─────────────────────────────────────────────────────────────────
  { id: 'evening_review_7', icon: '🌙', name: 'Nottambulo', cat: 'special',
    desc: 'Usa la revisione serale per 7 giorni',
    check: () => parseInt(localStorage.getItem('glp_evening_review_count') || '0') >= 7,
    progress: () => ({
      current: Math.min(parseInt(localStorage.getItem('glp_evening_review_count') || '0'), 7),
      target: 7,
    }) },

  { id: 'stats_10', icon: '📊', name: 'Analista', cat: 'special',
    desc: 'Apri le statistiche 10 volte',
    check: () => parseInt(localStorage.getItem('glp_stats_opens') || '0') >= 10,
    progress: () => ({
      current: Math.min(parseInt(localStorage.getItem('glp_stats_opens') || '0'), 10),
      target: 10,
    }) },

  { id: 'versatile_themes', icon: '🎭', name: 'Versatile', cat: 'special',
    desc: 'Usa tutti e 5 i temi almeno una volta',
    check: () => {
      try { return JSON.parse(localStorage.getItem('glp_themes_used') || '[]').length >= 5 } catch { return false }
    },
    progress: () => {
      try { return { current: JSON.parse(localStorage.getItem('glp_themes_used') || '[]').length, target: 5 } } catch { return { current: 0, target: 5 } }
    } },

  { id: 'scriba', icon: '✍️', name: 'Scriba', cat: 'special',
    desc: 'Compila il diario per 7 giorni consecutivi',
    check: (ud) => _journalStreak(ud) >= 7,
    progress: (ud) => ({ current: Math.min(_journalStreak(ud), 7), target: 7 }) },

  { id: 'why_5', icon: '💡', name: 'Consapevole', cat: 'special',
    desc: 'Aggiungi il "perché" a 5 abitudini',
    check: (ud) => (ud?.habits || []).filter(h => h.why?.trim()).length >= 5,
    progress: (ud) => ({
      current: Math.min((ud?.habits || []).filter(h => h.why?.trim()).length, 5),
      target: 5,
    }) },
]

// ─── Private helpers ──────────────────────────────────────────────────────────

function _totalDone(ud) {
  let count = 0
  Object.values(ud?.dailyLogs || {}).forEach(log => {
    const habits = Array.isArray(log) ? log : (log?.habits || [])
    count += habits.length
  })
  return count
}

function _maxSingleHabitDone(ud) {
  const counts = {}
  Object.values(ud?.dailyLogs || {}).forEach(log => {
    const habits = Array.isArray(log) ? log : (log?.habits || [])
    habits.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
  })
  return Math.max(0, ...Object.values(counts))
}

function _totalPurchases(ud) {
  let count = 0
  Object.values(ud?.dailyLogs || {}).forEach(log => {
    count += (Array.isArray(log) ? 0 : (log?.purchases?.length || 0))
  })
  return count
}

function _maxSinglePurchase(ud) {
  let max = 0
  Object.values(ud?.dailyLogs || {}).forEach(log => {
    if (Array.isArray(log)) return
    ;(log?.purchases || []).forEach(p => { if (parseInt(p.cost || 0) > max) max = parseInt(p.cost) })
  })
  return max
}

function _hasPerfectDay(ud) {
  const activeHabits = (ud?.habits || []).filter(h => !h.archivedAt && h.type !== 'goal' && h.type !== 'if')
  if (activeHabits.length === 0) return false
  return Object.keys(ud?.dailyLogs || {}).some(dateStr => {
    const entry = parseEntry(ud.dailyLogs[dateStr])
    const visibleThatDay = activeHabits.filter(h => {
      const created = h.changes?.[0]?.date || '2020-01-01'
      return dateStr >= created
    })
    if (visibleThatDay.length === 0) return false
    return visibleThatDay.every(h => {
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      return entry.habits.includes(sid)
    })
  })
}

function _hasBalancedDay(ud) {
  const tags = (ud?.habits || []).map(h => h.tagId).filter(Boolean)
  const uniqueTags = [...new Set(tags)]
  if (uniqueTags.length < 2) return false
  return Object.keys(ud?.dailyLogs || {}).some(dateStr => {
    const entry = parseEntry(ud.dailyLogs[dateStr])
    const doneTagsInDay = new Set()
    entry.habits.forEach(hId => {
      const h = ud.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h?.tagId) doneTagsInDay.add(h.tagId)
    })
    return uniqueTags.every(t => doneTagsInDay.has(t))
  })
}

function _journalStreak(ud) {
  let streak = 0
  const today = new Date()
  const entries = ud?.journalEntries || {}
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    if (entries[ds]?.answer) { streak++ } else { if (i > 0) break; }
  }
  return streak
}

function _noPenaltyStreak(ud) {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const log = ud?.dailyLogs?.[ds]
    if (!log) { if (i > 0) break; continue }
    const entry = parseEntry(log)
    if ((entry.failedHabits || []).length > 0) break
    streak++
  }
  return streak
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns list of achievement defs that are newly unlocked (not in unlockedIds).
 * @param {object} userData
 * @param {string[]} unlockedIds  Already-unlocked achievement IDs
 * @param {object} extra  { currentStreak }
 */
export function checkNewAchievements(userData, unlockedIds = [], extra = {}) {
  const newlyUnlocked = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (unlockedIds.includes(def.id)) continue
    try {
      if (def.check(userData, extra)) newlyUnlocked.push(def)
    } catch { /* non-critical */ }
  }
  return newlyUnlocked
}

/** Calculate progress (0-1) for a locked achievement */
export function getAchievementProgress(def, userData, extra = {}) {
  if (!def.progress) return null
  try {
    return def.progress(userData, extra)
  } catch { return null }
}

/** Compute current streak from user data */
export function computeCurrentStreak(userData) {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const log = userData?.dailyLogs?.[ds]
    const habits = Array.isArray(log) ? log : (log?.habits || [])
    if (habits.length > 0) { streak++; } else { if (i > 0) break; }
  }
  return streak
}

/** Track localStorage-based events */
export function trackEvent(key) {
  const cur = parseInt(localStorage.getItem(key) || '0')
  localStorage.setItem(key, String(cur + 1))
}

export function trackThemeUsed(themeId) {
  try {
    const used = JSON.parse(localStorage.getItem('glp_themes_used') || '[]')
    if (!used.includes(themeId)) {
      used.push(themeId)
      localStorage.setItem('glp_themes_used', JSON.stringify(used))
    }
  } catch { /* ignore */ }
}
