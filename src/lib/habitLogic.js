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
  if (!entry) return { habits: [], failedHabits: [], habitLevels: {}, purchases: [] }
  if (Array.isArray(entry)) {
    return { habits: entry, failedHabits: [], habitLevels: {}, purchases: [] }
  }
  return {
    habits: entry.habits || [],
    failedHabits: entry.failedHabits || [],
    habitLevels: entry.habitLevels || {},
    purchases: entry.purchases || [],
  }
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
  const spent = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  return net - spent
}

export function toDateString(date) {
  return date.toISOString().split('T')[0]
}

export function formatDisplayDate(dateStr) {
  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'OGGI'
  if (dateStr === yesterday) return 'IERI'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}
