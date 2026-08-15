// getItemValueAtDate: reads the value of a field at a specific date
// using the changes[] history array. Critical for correct historical calculation.
export function getItemValueAtDate(item, field, dateStr) {
  if (!item) return 0
  if (!item.changes || item.changes.length === 0) {
    if (field === 'isMulti') return item.isMulti || false
    if (field === 'description') return item.description || ''
    return parseInt(item[field] || 0)
  }
  const sorted = item.changes.slice().sort((a, b) => a.date.localeCompare(b.date))
  let valid = null
  for (const ch of sorted) {
    if (ch.date <= dateStr) valid = ch
    else break
  }
  if (valid) {
    if (field === 'isMulti') return valid.isMulti || false
    if (field === 'description') return valid.description || ''
    return parseInt(valid[field] || 0)
  }
  // Before first change: use the earliest recorded value
  if (field === 'isMulti') return sorted[0].isMulti || false
  if (field === 'description') return sorted[0].description || ''
  return parseInt(sorted[0][field] || 0)
}

// Parse a dailyLog entry handling both legacy (array) and new (object) formats
export function parseEntry(entry) {
  if (!entry) return { habits: [], failedHabits: [], habitLevels: {}, purchases: [], habitNotes: {}, habitValues: {}, mood: {}, trackedRewards: {} }
  if (Array.isArray(entry)) {
    return { habits: entry, failedHabits: [], habitLevels: {}, purchases: [], habitNotes: {}, habitValues: {}, mood: {}, trackedRewards: {} }
  }
  return {
    habits: entry.habits || [],
    failedHabits: entry.failedHabits || [],
    habitLevels: entry.habitLevels || {},
    purchases: entry.purchases || [],
    habitNotes: entry.habitNotes || {},
    habitValues: entry.habitValues || {},
    mood: entry.mood || {},
    energy: entry.energy || {},
    trackedRewards: entry.trackedRewards || {},
  }
}

// Calculate cost for a tracked reward given quantity
export function calcTrackedCost(quantity, reward) {
  const threshold = Math.max(1, parseInt(reward.threshold) || 1)
  const cpt = parseInt(reward.costPerThreshold) || 0
  return Math.floor(Math.max(0, parseInt(quantity) || 0) / threshold) * cpt
}

// Calculate points for a numeric habit given a value and config
export function calcNumericPoints(value, config) {
  if (!config) return 0
  const num = parseFloat(value) || 0
  const threshold = config.threshold || 0
  const unitSize = config.unitSize || 1
  const ppu = config.pointsPerUnit || 0

  if (num < threshold) {
    if (config.belowThreshold === 'zero') return 0
    if (config.belowThreshold === 'fixed') return -(config.penaltyFixed || 0)
    if (config.belowThreshold === 'proportional') {
      const deficit = threshold - num
      return -Math.round((deficit / unitSize) * ppu * 10) / 10
    }
    return 0
  }
  let pts = (num / unitSize) * ppu
  if (config.cap != null && pts > config.cap) pts = config.cap
  return Math.round(pts * 10) / 10
}

// Determine if a habit should be visible on viewStr
export function isHabitVisible(h, viewStr, doneHabits, failedHabits) {
  if (h.archivedAt && viewStr >= h.archivedAt) return false
  if (h.type === 'single') return h.targetDate === viewStr

  const createdDate = h.changes && h.changes.length > 0 ? h.changes[0].date : '2020-01-01'
  if (viewStr < createdDate) return false

  const stableId = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
  const isDone = doneHabits.includes(stableId)
  const isFailed = failedHabits.includes(stableId)
  const freq = h.frequency || 1

  if (h.type !== 'if' && freq > 1) {
    if (isDone || isFailed) return true
    if (h.lastDone) {
      const diff = Math.ceil((new Date(viewStr) - new Date(h.lastDone)) / 86400000)
      if (diff < freq && diff >= 0) return false
    }
  }
  return true
}

// Calculate current streak for a habit (days in a row including today)
export function calculateStreak(habitId, dailyLogs) {
  let streak = 0
  const d = new Date()
  // Walk backwards from today
  for (let i = 0; i < 365; i++) {
    const str = toDateString(d)
    const { habits } = parseEntry(dailyLogs[str])
    if (habits.includes(habitId)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ─── Fonte unica di verità per il calcolo dei punti ────────────────────────────
// Calcola il "Netto" completo di una singola giornata: abitudini (fatte/fallite/
// numeriche), acquisti negozio, premi tracciati, esercizi rapidi, check-in,
// letture e task (completate/scadute quel giorno). Usata sia per il "Netto Oggi"
// live in App.jsx, sia per i grafici storici (getDailyNet), sia per il punteggio
// totale (calculateTotalScore) — un'unica formula, mai più duplicata.
export function computeDayNet(userData, dateStr) {
  const empty = {
    totalHabitPoints: 0, taskPts: 0, extraPts: 0, checkInPts: 0, readingPts: 0,
    purchaseCost: 0, penaltyCost: 0, trackedCost: 0, dailySpent: 0, expiredTaskCost: 0,
    net: 0,
  }
  if (!userData) return empty

  const entry = parseEntry(userData.dailyLogs?.[dateStr])
  const habits = userData.habits || []

  let dailyEarned = 0, penaltyCost = 0

  habits.forEach(h => {
    if (h.type === 'goal') return
    if (!isHabitVisible(h, dateStr, entry.habits, entry.failedHabits)) return
    const stableId = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const reward = getItemValueAtDate(h, 'reward', dateStr)
    const rewardMin = getItemValueAtDate(h, 'rewardMin', dateStr)
    const penalty = getItemValueAtDate(h, 'penalty', dateStr)
    const isMulti = getItemValueAtDate(h, 'isMulti', dateStr)
    const isDone = entry.habits.includes(stableId)
    const isFailed = entry.failedHabits.includes(stableId)
    const level = entry.habitLevels[stableId] || 'max'
    if (isDone) dailyEarned += isMulti && level === 'min' ? rewardMin : reward
    if (isFailed) penaltyCost += penalty
  })

  const numericHabitPoints = habits
    .filter(h => h.numericConfig && entry.habitValues?.[h.id] != null)
    .reduce((sum, h) => {
      const pts = calcNumericPoints(parseFloat(entry.habitValues[h.id]), h.numericConfig)
      return sum + (pts > 0 ? pts : 0)
    }, 0)

  const totalHabitPoints = dailyEarned + numericHabitPoints

  const purchaseCost = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  const trackedCost = Object.values(entry.trackedRewards || {})
    .reduce((sum, tr) => sum + (parseInt(tr.cost) || 0), 0)
  const dailySpent = penaltyCost + purchaseCost + trackedCost

  const extraPts = Math.round(
    ((userData.exerciseLog || {})[dateStr] || [])
      .reduce((sum, s) => sum + (parseFloat(s.pts) || 0), 0) * 10
  ) / 10

  const checkInPts = Object.values(userData.dailyLogs?.[dateStr]?.checkIns || {})
    .filter(c => c?.done)
    .reduce((sum, c) => sum + (c.pts || 1), 0)

  const readingPts = userData.dailyLogs?.[dateStr]?.readingEarned || 0

  const taskPts = (userData.tasks || [])
    .filter(t => t.status === 'completed' && typeof t.completedAt === 'string' && t.completedAt.startsWith(dateStr))
    .reduce((sum, t) => sum + (parseInt(t.reward) || 0), 0)

  const expiredTaskCost = (userData.tasks || [])
    .filter(t => {
      if (!t.expiredAt || !t.penaltyApplied) return false
      const d = new Date(t.expiredAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
      return d === dateStr
    })
    .reduce((sum, t) => sum + (parseInt(t.penalty) || 0), 0)

  const net = totalHabitPoints + taskPts + extraPts + checkInPts + readingPts - dailySpent - expiredTaskCost

  return { totalHabitPoints, taskPts, extraPts, checkInPts, readingPts, purchaseCost, penaltyCost, trackedCost, dailySpent, expiredTaskCost, net }
}

// Calculate net points for a single day for a given user's data
export function getDailyNet(userData, dateStr) {
  return computeDayNet(userData, dateStr).net
}

// Ricalcola il punteggio TOTALE sommando computeDayNet() su ogni giorno rilevante,
// più i bonus una tantum non legati a un giorno "Netto" (obiettivi completati,
// bonus mood). Unica fonte di verità per il punteggio mostrato in header.
export function calculateTotalScore(userData) {
  if (!userData) return 0

  const dates = new Set([
    ...Object.keys(userData.dailyLogs || {}),
    ...Object.keys(userData.exerciseLog || {}),
  ])
  ;(userData.tasks || []).forEach(t => {
    if (typeof t.completedAt === 'string') dates.add(t.completedAt.slice(0, 10))
    if (typeof t.expiredAt === 'string') {
      dates.add(new Date(t.expiredAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }))
    }
  })

  let total = 0
  dates.forEach(dateStr => { total += computeDayNet(userData, dateStr).net })

  // Bonus obiettivi completati (non legati a un giorno specifico nel Netto)
  ;(userData.habits || []).forEach(h => {
    if (h.type === 'goal' && h.goalConfig?.completedAt) {
      total += h.goalConfig.rewardOnComplete || 0
    }
  })

  // Bonus mood (+0.5pt una tantum per giorno in cui è stato salvato)
  Object.values(userData.dailyLogs || {}).forEach(rawEntry => {
    if (rawEntry && typeof rawEntry === 'object' && rawEntry.moodPtsGiven === true) {
      total += 0.5
    }
  })

  return Math.round(total * 100) / 100
}

export function toDateString(date) {
  // Usa data locale (non UTC) per evitare bug alle 00:xx ora italiana
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function countPerfectDays(habits, dailyLogs) {
  if (!habits || !dailyLogs) return 0
  let count = 0
  for (const [date, rawEntry] of Object.entries(dailyLogs)) {
    const entry = parseEntry(rawEntry)
    if (!entry.habits || entry.habits.length === 0) continue
    if (entry.failedHabits.length === 0 && entry.habits.length >= 5) count++
  }
  return count
}

export function formatDisplayDate(dateStr) {
  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'OGGI'
  if (dateStr === yesterday) return 'IERI'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}
