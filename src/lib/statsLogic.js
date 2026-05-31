import { parseEntry, getItemValueAtDate, toDateString } from './habitLogic'

// Build an array of { dateStr, net } for the last N days for a user
export function buildDailyNets(userData, days) {
  const result = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
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
    net -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
    result.push({ dateStr, net, label: `${d.getDate()}/${d.getMonth() + 1}` })
  }
  return result
}

// Build weekly aggregates: last N weeks → array of { weekLabel, net }
export function buildWeeklyNets(userData, weeks = 12) {
  const today = new Date()
  const result = []
  for (let w = weeks - 1; w >= 0; w--) {
    let weekNet = 0
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - w * 7 - 6)
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + d)
      const dateStr = toDateString(day)
      const entry = parseEntry(userData?.dailyLogs?.[dateStr])
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) {
          const isM = getItemValueAtDate(h, 'isMulti', dateStr)
          const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
          const rMax = getItemValueAtDate(h, 'reward', dateStr)
          const lvl = entry.habitLevels[hId] || 'max'
          weekNet += isM && lvl === 'min' ? rMin : rMax
        }
      })
      entry.failedHabits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) weekNet -= getItemValueAtDate(h, 'penalty', dateStr)
      })
      weekNet -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
    }
    // Label: date of first day of week
    const label = `${startDate.getDate()}/${startDate.getMonth() + 1}`
    result.push({ label, net: weekNet })
  }
  return result
}

// Tag score breakdown for a user
export function buildTagScores(userData) {
  const tagScores = {}
  Object.keys(userData?.dailyLogs || {}).forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) {
        const isM = getItemValueAtDate(h, 'isMulti', dateStr)
        const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
        const rMax = getItemValueAtDate(h, 'reward', dateStr)
        const lvl = entry.habitLevels[hId] || 'max'
        const pts = isM && lvl === 'min' ? rMin : rMax
        const tId = h.tagId || '__none__'
        tagScores[tId] = (tagScores[tId] || 0) + pts
      }
    })
  })
  return tagScores
}

// Personal records for a user
export function buildRecords(userData) {
  let maxNet = -Infinity, bestDay = null
  let minNet = Infinity, worstDay = null
  let bestStreakEver = 0, tempStreak = 0, currentStreak = 0
  const today = toDateString(new Date())

  // Habit that was never failed
  const failedSet = new Set()
  const doneSet = new Set()

  // Most purchased reward
  const rewardCount = {}

  const sortedDates = Object.keys(userData?.dailyLogs || {}).sort()
  sortedDates.forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    let dayEarn = 0, daySpent = 0

    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) {
        doneSet.add(hId)
        const isM = getItemValueAtDate(h, 'isMulti', dateStr)
        const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
        const rMax = getItemValueAtDate(h, 'reward', dateStr)
        const lvl = entry.habitLevels[hId] || 'max'
        dayEarn += isM && lvl === 'min' ? rMin : rMax
      }
    })
    entry.failedHabits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) { failedSet.add(hId); daySpent += getItemValueAtDate(h, 'penalty', dateStr) }
    })
    entry.purchases.forEach(p => {
      rewardCount[p.name] = (rewardCount[p.name] || 0) + 1
      daySpent += parseInt(p.cost || 0)
    })

    const dayNet = dayEarn - daySpent
    if (dayNet > maxNet) { maxNet = dayNet; bestDay = dateStr }
    if (dayNet < minNet) { minNet = dayNet; worstDay = dateStr }

    // Global streak (any day with earned > 0 counts)
    if (dayEarn > 0) { tempStreak++; if (tempStreak > bestStreakEver) bestStreakEver = tempStreak }
    else tempStreak = 0
  })

  // Current streak (consecutive days ending today with earned > 0)
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const str = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[str])
    const earned = entry.habits.reduce((acc, hId) => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return acc
      const rMax = getItemValueAtDate(h, 'reward', str)
      return acc + rMax
    }, 0)
    if (earned > 0) { currentStreak++; d.setDate(d.getDate() - 1) }
    else break
  }

  const neverFailed = userData?.habits?.filter(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    return doneSet.has(sid) && !failedSet.has(sid) && !h.archivedAt
  }) || []

  const favReward = Object.keys(rewardCount).length > 0
    ? Object.keys(rewardCount).reduce((a, b) => rewardCount[a] > rewardCount[b] ? a : b)
    : null

  return {
    bestDay, maxNet: maxNet === -Infinity ? 0 : maxNet,
    worstDay, minNet: minNet === Infinity ? 0 : minNet,
    bestStreakEver, currentStreak,
    neverFailed: neverFailed.slice(0, 3).map(h => h.name),
    favReward, favRewardCount: favReward ? rewardCount[favReward] : 0,
  }
}

// Monthly heatmap: returns array of { dateStr, net, dayNum } for given year/month
export function buildMonthHeatmap(userData, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const result = []
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
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
    net -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
    const hasData = userData?.dailyLogs?.[dateStr] !== undefined
    result.push({ dateStr, net, dayNum: d, hasData })
  }
  return result
}

// Habit-specific stats
export function buildHabitStats(habit, globalData) {
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const datesMap = {}
  let totalDone = 0, totalFail = 0
  let bestStreak = 0, tempStreak = 0, currentStreak = 0
  let totalPoints = 0
  const DOW_DONE = [0, 0, 0, 0, 0, 0, 0] // Sun=0..Sat=6
  const weeklyPoints = {} // weekKey → points

  const sortedDates = Object.keys(globalData?.dailyLogs || {}).sort()
  sortedDates.forEach(dateStr => {
    const entry = parseEntry(globalData.dailyLogs[dateStr])
    const isDone = entry.habits.includes(stableId)
    const isFail = entry.failedHabits.includes(stableId)
    if (isDone) {
      totalDone++; tempStreak++; datesMap[dateStr] = 'done'
      DOW_DONE[new Date(dateStr).getDay()]++
      const isM = getItemValueAtDate(habit, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(habit, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(habit, 'reward', dateStr)
      const lvl = entry.habitLevels[stableId] || 'max'
      const pts = isM && lvl === 'min' ? rMin : rMax
      totalPoints += pts
      // Aggregate by week (ISO week key: year-W##)
      const d = new Date(dateStr)
      const weekNum = getISOWeek(d)
      const wkey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
      weeklyPoints[wkey] = (weeklyPoints[wkey] || 0) + pts
    } else {
      if (isFail) { totalFail++; datesMap[dateStr] = 'fail' }
      if (tempStreak > bestStreak) bestStreak = tempStreak
      tempStreak = 0
    }
  })
  if (tempStreak > bestStreak) bestStreak = tempStreak

  // Current streak (walk back from today)
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const str = toDateString(d)
    if (datesMap[str] === 'done') { currentStreak++; d.setDate(d.getDate() - 1) }
    else break
  }

  const totalAttempts = totalDone + totalFail
  const winRate = totalAttempts > 0 ? Math.round((totalDone / totalAttempts) * 100) : 0

  // Total points of user overall (for weight %)
  let allPoints = 0
  Object.keys(globalData?.dailyLogs || {}).forEach(dateStr => {
    const entry = parseEntry(globalData.dailyLogs[dateStr])
    entry.habits.forEach(hId => {
      const h = globalData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) {
        const isM = getItemValueAtDate(h, 'isMulti', dateStr)
        const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
        const rMax = getItemValueAtDate(h, 'reward', dateStr)
        const lvl = entry.habitLevels[hId] || 'max'
        allPoints += isM && lvl === 'min' ? rMin : rMax
      }
    })
  })
  const weightPct = allPoints > 0 ? Math.round((totalPoints / allPoints) * 100) : 0

  // Best day of week
  const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const bestDOW = DOW_DONE.indexOf(Math.max(...DOW_DONE))
  const bestDOWLabel = Math.max(...DOW_DONE) > 0 ? DAYS_IT[bestDOW] : '-'

  // Last 12 weeks points
  const today = new Date()
  const last12Weeks = []
  for (let w = 11; w >= 0; w--) {
    const start = new Date(today)
    start.setDate(today.getDate() - w * 7 - 6)
    let wPts = 0
    for (let dd = 0; dd < 7; dd++) {
      const day = new Date(start); day.setDate(start.getDate() + dd)
      const str = toDateString(day)
      if (datesMap[str] === 'done') {
        const entry = parseEntry(globalData.dailyLogs[str])
        const isM = getItemValueAtDate(habit, 'isMulti', str)
        const rMin = getItemValueAtDate(habit, 'rewardMin', str)
        const rMax = getItemValueAtDate(habit, 'reward', str)
        const lvl = entry.habitLevels[stableId] || 'max'
        wPts += isM && lvl === 'min' ? rMin : rMax
      }
    }
    last12Weeks.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, pts: wPts })
  }

  // Heatmap 90 days
  const heatmap90 = []
  for (let i = 89; i >= 0; i--) {
    const day = new Date(today); day.setDate(today.getDate() - i)
    const key = toDateString(day)
    heatmap90.push({ key, status: datesMap[key] || 'empty' })
  }

  return {
    totalDone, totalFail, winRate, bestStreak, currentStreak,
    totalPoints, weightPct, bestDOWLabel, last12Weeks, heatmap90, datesMap,
  }
}

// Reward-specific stats
export function buildRewardStats(reward, globalData) {
  const purchases = []
  Object.keys(globalData?.dailyLogs || {}).sort().forEach(dateStr => {
    const entry = parseEntry(globalData.dailyLogs[dateStr])
    entry.purchases.forEach(p => {
      if (p.name === reward.name) purchases.push({ dateStr, cost: parseInt(p.cost || 0), time: p.time })
    })
  })

  const totalCount = purchases.length
  const totalCost = purchases.reduce((acc, p) => acc + p.cost, 0)
  const lastPurchase = purchases.length > 0 ? purchases[purchases.length - 1].dateStr : null

  // Average frequency (days between purchases)
  let avgFreqDays = null
  if (purchases.length >= 2) {
    const first = new Date(purchases[0].dateStr)
    const last = new Date(purchases[purchases.length - 1].dateStr)
    const totalDays = Math.round((last - first) / 86400000)
    avgFreqDays = Math.round(totalDays / (purchases.length - 1))
  }

  // Monthly bar chart: last 12 months
  const today = new Date()
  const monthlyData = []
  for (let m = 11; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = `${d.toLocaleString('it', { month: 'short' })} ${year !== today.getFullYear() ? year : ''}`
    const count = purchases.filter(p => {
      const pd = new Date(p.dateStr)
      return pd.getFullYear() === year && pd.getMonth() === month
    }).length
    monthlyData.push({ label, count })
  }

  return { totalCount, totalCost, lastPurchase, avgFreqDays, monthlyData }
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// ---- TAG STATISTICS ----

// Points per tag in last N days
export function buildTagStats(userData, days) {
  const result = {}
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return
      const isM = getItemValueAtDate(h, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(h, 'reward', dateStr)
      const lvl = entry.habitLevels[hId] || 'max'
      const pts = isM && lvl === 'min' ? rMin : rMax
      const tId = h.tagId || '__none__'
      if (!result[tId]) result[tId] = { pts: 0, count: 0 }
      result[tId].pts += pts
      result[tId].count++
    })
  }
  return result
}

// Weekly points for a specific tag, last N weeks
export function buildTagWeeklyTrend(userData, tagId, weeks = 12) {
  const today = new Date()
  return Array.from({ length: weeks }, (_, w) => {
    const wIdx = weeks - 1 - w
    let pts = 0
    const start = new Date(today); start.setDate(today.getDate() - wIdx * 7 - 6)
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + d)
      const dateStr = toDateString(day)
      const entry = parseEntry(userData?.dailyLogs?.[dateStr])
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (!h || (h.tagId || '__none__') !== tagId) return
        const isM = getItemValueAtDate(h, 'isMulti', dateStr)
        const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
        const rMax = getItemValueAtDate(h, 'reward', dateStr)
        const lvl = entry.habitLevels[hId] || 'max'
        pts += isM && lvl === 'min' ? rMin : rMax
      })
    }
    return { label: `${start.getDate()}/${start.getMonth() + 1}`, pts }
  })
}

// Lifetime stats for a specific tag
export function buildTagDetailStats(userData, tagId) {
  const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const habitsInTag = (userData?.habits || []).filter(h => (h.tagId || '__none__') === tagId)

  let totalPts = 0, totalDone = 0, totalFail = 0
  const DOW = [0,0,0,0,0,0,0]
  const habitPts = {}  // habitId → points
  let bestStreak = 0, tempStreak = 0

  const sortedDates = Object.keys(userData?.dailyLogs || {}).sort()
  sortedDates.forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    let anyDone = false
    habitsInTag.forEach(h => {
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      const isDone = entry.habits.includes(sid)
      const isFail = entry.failedHabits.includes(sid)
      if (isDone) {
        const isM = getItemValueAtDate(h, 'isMulti', dateStr)
        const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
        const rMax = getItemValueAtDate(h, 'reward', dateStr)
        const lvl = entry.habitLevels[sid] || 'max'
        const pts = isM && lvl === 'min' ? rMin : rMax
        totalPts += pts; totalDone++; anyDone = true
        DOW[new Date(dateStr).getDay()]++
        habitPts[h.name] = (habitPts[h.name] || 0) + pts
      }
      if (isFail) totalFail++
    })
    if (anyDone) { tempStreak++; if (tempStreak > bestStreak) bestStreak = tempStreak }
    else tempStreak = 0
  })

  const totalAttempts = totalDone + totalFail
  const avgCompletion = totalAttempts > 0 ? Math.round((totalDone / totalAttempts) * 100) : 0
  const bestHabit = Object.keys(habitPts).sort((a, b) => habitPts[b] - habitPts[a])[0] || '-'
  const bestDOW = DAYS_IT[DOW.indexOf(Math.max(...DOW))] || '-'

  return { totalPts, totalDone, avgCompletion, bestHabit, bestDOW, bestStreak }
}

// All purchases from a user's dailyLogs — returns sorted array
export function getAllPurchases(userData) {
  const purchases = []
  Object.keys(userData?.dailyLogs || {}).sort().forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    entry.purchases.forEach(p => {
      purchases.push({ dateStr, name: p.name, cost: parseInt(p.cost || 0), time: p.time || 0 })
    })
  })
  return purchases.sort((a, b) => (b.time || 0) - (a.time || 0) || b.dateStr.localeCompare(a.dateStr))
}
