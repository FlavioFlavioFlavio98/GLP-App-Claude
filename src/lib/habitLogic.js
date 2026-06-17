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

// Calculate net points for a single day for a given user's data
export function getDailyNet(userData, dateStr) {
  if (!userData || !userData.dailyLogs) return 0
  const entry = parseEntry(userData.dailyLogs[dateStr])
  let net = 0
  entry.habits.forEach(hId => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) {
      const isM = getItemValueAtDate(h, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(h, 'reward', dateStr)
      const lvl = entry.habitLevels[hId] || 'max'
      net += isM && lvl === 'min' ? rMin : rMax
    }
  })
  entry.failedHabits.forEach(hId => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) net -= getItemValueAtDate(h, 'penalty', dateStr)
  })
  const numericPts = Object.entries(entry.habitValues || {}).reduce((sum, [hId, val]) => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h?.numericConfig) {
      return sum + calcNumericPoints(parseFloat(val), h.numericConfig)
    }
    return sum
  }, 0)
  net += numericPts
  const spent = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  return net - spent
}

export function toDateString(date) {
  // Usa data locale (non UTC) per evitare bug alle 00:xx ora italiana
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Ricalcola il punteggio totale leggendo tutti i dailyLogs.
 * Usa questa invece di increment() per mantenere score e dailyLogs sincronizzati.
 * NON include task (gestite separatamente con increment()).
 */
export function recalculateScore(habits, rewards, dailyLogs) {
  if (!dailyLogs || !habits) return 0
  let total = 0

  for (const [date, rawEntry] of Object.entries(dailyLogs)) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const entry = parseEntry(rawEntry)

    // Abitudini completate
    for (const habitId of entry.habits) {
      const habit = habits.find(h => (h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      if (!habit) continue
      const isM = getItemValueAtDate(habit, 'isMulti', date)
      const rMin = getItemValueAtDate(habit, 'rewardMin', date)
      const rMax = getItemValueAtDate(habit, 'reward', date)
      const lvl = entry.habitLevels[habitId] || 'max'
      total += isM && lvl === 'min' ? rMin : rMax
    }

    // Penalita abitudini fallite
    for (const habitId of entry.failedHabits) {
      const habit = habits.find(h => (h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      if (habit) total -= getItemValueAtDate(habit, 'penalty', date)
    }

    // Abitudini numeriche
    for (const [habitId, value] of Object.entries(entry.habitValues)) {
      const habit = habits.find(h => (h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      if (habit?.numericConfig) total += calcNumericPoints(parseFloat(value), habit.numericConfig)
    }

    // Acquisti negozio (array di oggetti {name, cost, time})
    for (const p of entry.purchases) {
      const cost = typeof p === 'object' ? (parseInt(p.cost) || 0) : 0
      total -= cost
    }

    // Premi tracciati
    for (const [, data] of Object.entries(entry.trackedRewards || {})) {
      if (data && typeof data.cost === 'number') total -= data.cost
    }
  }

  return Math.round(total * 100) / 100
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
