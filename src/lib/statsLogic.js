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

// ---- MOOD STATISTICS ----

// Returns array of {dateStr, value, emoji, note} for last N days (only days with mood)
export function buildMoodTimeline(userData, userId, days = 30) {
  const today = new Date()
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    const mood = entry.mood?.[userId]
    result.push({
      dateStr,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      value: mood?.value ?? null,
      emoji: mood?.emoji ?? null,
      note: mood?.note ?? null,
    })
  }
  return result
}

// Returns daily net for each day, paired with mood
export function buildMoodCorrelation(userData, userId, days = 30) {
  const today = new Date()
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    const mood = entry.mood?.[userId]
    if (mood?.value) {
      const net = getDailyNetFromEntry(entry, userData, dateStr)
      result.push({ dateStr, mood: mood.value, net })
    }
  }
  return result
}

function getDailyNetFromEntry(entry, userData, dateStr) {
  let net = 0
  entry.habits.forEach(hId => {
    const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (!h) return
    if (h.numericType && h.numericConfig) {
      const val = entry.habitValues?.[hId]
      if (val !== undefined) {
        // inline numeric points calc
        const cfg = h.numericConfig
        const num = parseFloat(val) || 0
        let pts = 0
        if (num < (cfg.threshold || 0)) {
          if (cfg.belowThreshold === 'fixed') pts = -(cfg.penaltyFixed || 0)
          else if (cfg.belowThreshold === 'proportional') pts = -Math.round(((cfg.threshold - num) / (cfg.unitSize || 1)) * (cfg.pointsPerUnit || 0) * 10) / 10
        } else {
          pts = (num / (cfg.unitSize || 1)) * (cfg.pointsPerUnit || 0)
          if (cfg.cap != null && pts > cfg.cap) pts = cfg.cap
          pts = Math.round(pts * 10) / 10
        }
        net += pts
      }
    } else {
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
  return net
}

// Average mood per mood level → avg net. Returns [{moodVal, avgNet, count}]
export function buildMoodNetAverage(userData, userId, days = 60) {
  const correlation = buildMoodCorrelation(userData, userId, days)
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  correlation.forEach(({ mood, net }) => { buckets[mood]?.push(net) })
  return [1, 2, 3, 4, 5].map(v => ({
    moodVal: v,
    avgNet: buckets[v].length ? Math.round(buckets[v].reduce((a, b) => a + b, 0) / buckets[v].length) : null,
    count: buckets[v].length,
  }))
}

// ---- TREND (7 days vs prev 7 days) ----
export function buildWeekTrend(userData) {
  const today = new Date()
  let recent = 0, prev = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    recent += getDailyNetFromEntry(entry, userData, dateStr)
  }
  for (let i = 7; i < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const dateStr = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    prev += getDailyNetFromEntry(entry, userData, dateStr)
  }
  const recentAvg = recent / 7
  const prevAvg = prev / 7
  let pct = 0
  if (Math.abs(prevAvg) > 0.5) pct = ((recentAvg - prevAvg) / Math.abs(prevAvg)) * 100
  return { recent, prev, recentAvg, prevAvg, pct }
}

// ---- WEEKLY RECAP ----
export function buildWeeklyRecap(userData, currentUser) {
  const today = new Date()
  // This week (Mon–Sun)
  const dow = today.getDay() // 0=Sun
  const daysFromMon = dow === 0 ? 6 : dow - 1
  const monDate = new Date(today); monDate.setDate(today.getDate() - daysFromMon)
  const prevMonDate = new Date(monDate); prevMonDate.setDate(monDate.getDate() - 7)

  let thisNet = 0, prevNet = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(monDate); d.setDate(monDate.getDate() + i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    thisNet += getDailyNetFromEntry(entry, userData, ds)
  }
  for (let i = 0; i < 7; i++) {
    const d = new Date(prevMonDate); d.setDate(prevMonDate.getDate() + i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    prevNet += getDailyNetFromEntry(entry, userData, ds)
  }

  // Best/worst habit this week
  const habitCounts = {}, failCounts = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(monDate); d.setDate(monDate.getDate() + i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    entry.habits.forEach(hId => { habitCounts[hId] = (habitCounts[hId] || 0) + 1 })
    entry.failedHabits.forEach(hId => { failCounts[hId] = (failCounts[hId] || 0) + 1 })
  }
  function habitName(id) {
    return userData.habits?.find(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === id)?.name || id
  }
  const topHabit = Object.keys(habitCounts).sort((a, b) => habitCounts[b] - habitCounts[a])[0]
  const topFail = Object.keys(failCounts).sort((a, b) => failCounts[b] - failCounts[a])[0]

  // Tag scores this week
  const tagScores = {}
  ;(userData?.tags || []).forEach(t => { tagScores[t.id] = 0 })
  for (let i = 0; i < 7; i++) {
    const d = new Date(monDate); d.setDate(monDate.getDate() + i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return
      const pts = getItemValueAtDate(h, 'reward', ds)
      const tag = h.tagId || '__none__'
      tagScores[tag] = (tagScores[tag] || 0) + pts
    })
  }
  const sortedTags = Object.keys(tagScores).sort((a, b) => tagScores[b] - tagScores[a])
  const bestTag = sortedTags[0] ? (userData.tags?.find(t => t.id === sortedTags[0])?.name || 'Nessuna') : '-'
  const worstTag = sortedTags[sortedTags.length - 1] ? (userData.tags?.find(t => t.id === sortedTags[sortedTags.length - 1])?.name || 'Nessuna') : '-'

  // Current streak
  const records = buildRecords(userData)

  // Motivational message
  const ratio = prevNet !== 0 ? thisNet / Math.abs(prevNet) : 1
  let msg
  if (thisNet > 0 && ratio >= 1.1) msg = '🔥 Settimana eccezionale! Stai superando i tuoi limiti.'
  else if (thisNet > 0) msg = '💪 Buona settimana! Continua così.'
  else if (thisNet >= -5) msg = '😐 Settimana nella norma. Un piccolo extra può fare la differenza.'
  else msg = '💡 Settimana difficile? Ogni giorno è un nuovo inizio.'

  return {
    thisNet, prevNet,
    topHabit: topHabit ? habitName(topHabit) : '-',
    topFail: topFail ? habitName(topFail) : '-',
    bestTag, worstTag,
    currentStreak: records.currentStreak,
    msg,
  }
}

// ---- NUMERIC HABIT TIMELINE ----
export function buildNumericTimeline(habit, globalData, days = 30) {
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i))
    const dateStr = toDateString(d)
    const entry = parseEntry(globalData?.dailyLogs?.[dateStr])
    const value = entry.habitValues?.[stableId]
    return { dateStr, label: `${d.getDate()}/${d.getMonth() + 1}`, value: value !== undefined ? parseFloat(value) : null }
  })
}

// ─── Monthly Timeline ─────────────────────────────────────────────────────────

export function buildMonthlyTimeline(userData, userId) {
  const today = new Date()
  const sortedDates = Object.keys(userData?.dailyLogs || {}).sort()
  if (sortedDates.length === 0) return []

  const firstDate = new Date(sortedDates[0])
  const result = []

  let y = firstDate.getFullYear()
  let m = firstDate.getMonth()
  const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

  while (y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth())) {
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    let net = 0, days = 0, moodSum = 0, moodCount = 0
    const habitCounts = {}, failCounts = {}
    let maxStreak = 0, tempStreak = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(m + 1).padStart(2, '0'); const dd = String(d).padStart(2, '0')
      const ds = `${y}-${mm}-${dd}`
      const entry = parseEntry(userData?.dailyLogs?.[ds])

      let dayNet = 0
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) {
          const isM = getItemValueAtDate(h, 'isMulti', ds)
          const rMin = getItemValueAtDate(h, 'rewardMin', ds)
          const rMax = getItemValueAtDate(h, 'reward', ds)
          const lvl = entry.habitLevels[hId] || 'max'
          dayNet += isM && lvl === 'min' ? rMin : rMax
          habitCounts[h.name] = (habitCounts[h.name] || 0) + 1
        }
      })
      entry.failedHabits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) { dayNet -= getItemValueAtDate(h, 'penalty', ds); failCounts[h.name] = (failCounts[h.name] || 0) + 1 }
      })
      dayNet -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)

      if (userData?.dailyLogs?.[ds] !== undefined) {
        net += dayNet; days++
        const mood = entry.mood?.[userId]?.value
        if (mood) { moodSum += mood; moodCount++ }
        if (entry.habits.length > 0) { tempStreak++ } else { if (tempStreak > maxStreak) maxStreak = tempStreak; tempStreak = 0 }
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak

    const avgDaily = days > 0 ? net / days : 0
    const topHabit = Object.keys(habitCounts).sort((a, b) => habitCounts[b] - habitCounts[a])[0] || null
    const topFail = Object.keys(failCounts).sort((a, b) => failCounts[b] - failCounts[a])[0] || null
    const avgMood = moodCount > 0 ? moodSum / moodCount : null
    const MOOD_EMOJIS = ['', '😞', '😕', '😐', '😊', '🤩']
    const moodEmoji = avgMood !== null ? MOOD_EMOJIS[Math.round(avgMood)] : null

    result.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTHS_IT[m]} ${y}`,
      net, days, avgDaily: Math.round(avgDaily * 10) / 10,
      topHabit, topFail, avgMood, moodEmoji, maxStreak,
    })

    m++; if (m > 11) { m = 0; y++ }
  }
  return result
}

// ─── Yearly Heatmap ───────────────────────────────────────────────────────────

export function buildYearlyHeatmap(userData, year) {
  const result = []
  const dayOne = new Date(year, 0, 1)
  // Start from Monday of the first week
  const start = new Date(dayOne)
  const dow0 = start.getDay() // 0=Sun
  const offset = dow0 === 0 ? -6 : 1 - dow0  // shift so week starts Monday
  start.setDate(start.getDate() + offset)

  // 52 weeks × 7 days
  let bestNet = -Infinity, bestDay = null

  for (let w = 0; w < 53; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const ds = toDateString(date)
      const inYear = date.getFullYear() === year

      if (!inYear) { week.push({ dateStr: ds, net: null, hasData: false, inYear: false }); continue }

      const entry = parseEntry(userData?.dailyLogs?.[ds])
      const hasData = userData?.dailyLogs?.[ds] !== undefined
      let net = 0
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) {
          const isM = getItemValueAtDate(h, 'isMulti', ds)
          const rMin = getItemValueAtDate(h, 'rewardMin', ds)
          const rMax = getItemValueAtDate(h, 'reward', ds)
          const lvl = entry.habitLevels[hId] || 'max'
          net += isM && lvl === 'min' ? rMin : rMax
        }
      })
      entry.failedHabits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) net -= getItemValueAtDate(h, 'penalty', ds)
      })
      net -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)

      if (hasData && net > bestNet) { bestNet = net; bestDay = ds }
      week.push({
        dateStr: ds, net, hasData, inYear,
        done: entry.habits.length, failed: entry.failedHabits.length,
        mood: entry.mood || {},
      })
    }
    result.push(week)
  }
  return { weeks: result, bestDay, bestNet: bestNet === -Infinity ? null : bestNet }
}

// ─── Momentum Score ───────────────────────────────────────────────────────────

function _stdDev30(arr) {
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - avg) ** 2, 0) / arr.length)
}

export function calcMomentumScore(userData) {
  if (!userData) return 0
  const today = new Date()
  const nets = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    let net = 0
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) { const isM = getItemValueAtDate(h, 'isMulti', ds); const rMin = getItemValueAtDate(h, 'rewardMin', ds); const rMax = getItemValueAtDate(h, 'reward', ds); const lvl = entry.habitLevels[hId] || 'max'; net += isM && lvl === 'min' ? rMin : rMax }
    })
    entry.failedHabits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) net -= getItemValueAtDate(h, 'penalty', ds)
    })
    net -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)
    nets.push(net)
  }

  const last7 = nets.slice(0, 7), prev7 = nets.slice(7, 14), all30 = nets
  const avg7 = last7.reduce((a, b) => a + b, 0) / 7
  const avgPrev7 = prev7.reduce((a, b) => a + b, 0) / 7
  const avg30 = all30.reduce((a, b) => a + b, 0) / 30

  const trendRaw = avgPrev7 !== 0 ? avg7 / Math.abs(avgPrev7) : (avg7 > 0 ? 1 : 0)
  const trend7 = Math.max(0, Math.min(1, trendRaw))

  // Streak
  let streak = 0, d2 = new Date(today)
  for (let i = 0; i < 365; i++) {
    const ds = toDateString(d2)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    if (entry.habits.length > 0) { streak++; d2.setDate(d2.getDate() - 1) } else break
  }
  const streakScore = Math.min(streak / 30, 1)

  const daysAboveAvg = last7.filter(n => n >= avg30).length / 7
  const std30 = _stdDev30(all30)
  const consistency = avg30 > 0.5 ? Math.max(0, Math.min(1, 1 - std30 / (Math.abs(avg30) + 1))) : 0

  const score = Math.round(trend7 * 35 + streakScore * 30 + daysAboveAvg * 20 + consistency * 15)
  return { score: Math.max(0, Math.min(100, score)), trend7: Math.round(avg7 * 10) / 10, avgPrev7: Math.round(avgPrev7 * 10) / 10, streak, daysAboveAvg: Math.round(daysAboveAvg * 7), consistency: Math.round(consistency * 100), avg30: Math.round(avg30 * 10) / 10 }
}

export function buildMomentumHistory(userData, days = 30) {
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const anchor = new Date(today); anchor.setDate(today.getDate() - (days - 1 - i))
    // For history: just return net for simplicity (full recalc too expensive)
    const ds = toDateString(anchor)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    let net = 0
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) { net += getItemValueAtDate(h, 'reward', ds) }
    })
    return { label: `${anchor.getDate()}/${anchor.getMonth() + 1}`, net }
  })
}

// ─── Time Slot breakdown ──────────────────────────────────────────────────────

export function buildTimeSlotStats(userData, days = 30) {
  const today = new Date()
  const slots = { morning: { pts: 0, done: 0, appeared: 0 }, afternoon: { pts: 0, done: 0, appeared: 0 }, evening: { pts: 0, done: 0, appeared: 0 } }

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])

    ;(userData?.habits || []).filter(h => h.timeSlot && !h.archivedAt && h.type !== 'goal').forEach(h => {
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      const slot = h.timeSlot
      if (!slots[slot]) return
      const created = h.changes?.[0]?.date || '2020-01-01'
      if (ds < created) return
      slots[slot].appeared++
      if (entry.habits.includes(sid)) {
        slots[slot].done++
        slots[slot].pts += getItemValueAtDate(h, 'reward', ds)
      }
    })
  }

  return Object.keys(slots).map(s => ({
    slot: s,
    label: s === 'morning' ? '🌅 Mattina' : s === 'afternoon' ? '☀️ Pomeriggio' : '🌙 Sera',
    pts: slots[s].pts,
    winRate: slots[s].appeared > 0 ? Math.round((slots[s].done / slots[s].appeared) * 100) : null,
    appeared: slots[s].appeared,
  })).filter(s => s.appeared > 0)
}

// ─── Bubble Chart Data ────────────────────────────────────────────────────────

export function buildBubbleData(userData, days = 30) {
  const today = new Date()
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  const habitStats = {}
  ;(userData?.habits || []).filter(h => !h.archivedAt && h.type !== 'goal').forEach(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    habitStats[sid] = {
      name: h.name, id: h.id, tagId: h.tagId,
      importance: h.importance || 'medium',
      appeared: 0, done: 0, totalPts: 0,
      color: tagsMap[h.tagId]?.color || '#888',
    }
  })

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])

    Object.keys(habitStats).forEach(sid => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === sid)
      if (!h) return
      const created = h.changes?.[0]?.date || '2020-01-01'
      if (ds < created) return
      if (h.archivedAt && ds >= h.archivedAt) return
      habitStats[sid].appeared++
      if (entry.habits.includes(sid)) {
        habitStats[sid].done++
        const isM = getItemValueAtDate(h, 'isMulti', ds)
        const rMin = getItemValueAtDate(h, 'rewardMin', ds)
        const rMax = getItemValueAtDate(h, 'reward', ds)
        const lvl = entry.habitLevels[sid] || 'max'
        habitStats[sid].totalPts += isM && lvl === 'min' ? rMin : rMax
      }
    })
  }

  const WEEKS = days / 7
  return Object.values(habitStats)
    .filter(s => s.appeared >= 3)
    .map(s => ({
      id: s.id,
      name: s.name,
      tagId: s.tagId,
      importance: s.importance,
      x: parseFloat((s.appeared / WEEKS).toFixed(2)), // avg appearances per week
      y: s.appeared > 0 ? Math.round((s.done / s.appeared) * 100) : 0, // win rate %
      r: Math.max(4, Math.min(24, Math.sqrt(s.totalPts) * 1.5)), // bubble size
      totalPts: s.totalPts,
      color: s.color,
    }))
}

// ─── Energy Statistics ────────────────────────────────────────────────────────

export function buildEnergyTimeline(userData, userId, days = 30) {
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i))
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    const e = entry.energy?.[userId] || {}
    return {
      dateStr: ds,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      morning: e.morning ?? null,
      evening: e.evening ?? null,
    }
  })
}

export function buildEnergyCorrelations(userData, userId, days = 60) {
  const today = new Date()
  const morningBuckets = { 1: [], 2: [], 3: [] }
  const eveningMoodBuckets = { 1: [], 2: [], 3: [] }
  const DOW_ENERGY = [[], [], [], [], [], [], []]
  let morningTotal = 0, morningCount = 0
  let eveningTotal = 0, eveningCount = 0

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    const e = entry.energy?.[userId] || {}
    const mood = entry.mood?.[userId]?.value

    const active = (userData?.habits || []).filter(h => {
      if (h.type === 'goal' || h.archivedAt) return false
      const created = h.changes?.[0]?.date || '2020-01-01'
      return ds >= created
    })
    const winRate = active.length > 0
      ? Math.round(active.filter(h => entry.habits.includes(h.id || h.name.replace(/[^a-zA-Z0-9]/g, ''))).length / active.length * 100)
      : null

    if (e.morning) {
      morningTotal += e.morning; morningCount++
      if (winRate !== null) morningBuckets[e.morning].push(winRate)
      DOW_ENERGY[d.getDay()].push(e.morning)
    }
    if (e.evening) {
      eveningTotal += e.evening; eveningCount++
      if (mood) eveningMoodBuckets[e.evening].push(mood)
    }
  }

  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null

  const morningToWinRate = [1, 2, 3].map(v => ({
    level: v, avgWinRate: avg(morningBuckets[v]), count: morningBuckets[v].length
  }))
  const eveningToMood = [1, 2, 3].map(v => ({
    level: v, avgMood: avg(eveningMoodBuckets[v]), count: eveningMoodBuckets[v].length
  }))

  const DOW_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const dowAvgs = DOW_ENERGY.map((arr, i) => ({ day: DOW_IT[i], avg: avg(arr) || 0 }))
  const bestDOW = dowAvgs.reduce((best, d) => d.avg > best.avg ? d : best, dowAvgs[0])

  return {
    avgMorning: morningCount > 0 ? Math.round(morningTotal / morningCount * 10) / 10 : null,
    avgEvening: eveningCount > 0 ? Math.round(eveningTotal / eveningCount * 10) / 10 : null,
    morningToWinRate,
    eveningToMood,
    bestDOW: bestDOW.day,
    bestDOWAvg: bestDOW.avg,
    dowAvgs,
  }
}

// ─── Importance Insights ──────────────────────────────────────────────────────

export function buildImportanceInsights(userData) {
  const today = new Date()
  const highHabits = (userData?.habits || []).filter(h => h.importance === 'high' && !h.archivedAt && h.type !== 'goal')

  let weekFailed = [], weekDone = 0, weekTotal = 0

  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])

    highHabits.forEach(h => {
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      const created = h.changes?.[0]?.date || '2020-01-01'
      if (ds < created) return
      weekTotal++
      if (entry.habits.includes(sid)) weekDone++
      if (entry.failedHabits.includes(sid)) {
        if (!weekFailed.find(n => n === h.name)) weekFailed.push(h.name)
      }
    })
  }

  const winRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : null
  return { failedNames: weekFailed, winRate, weekTotal, weekDone }
}

// ─── Quality Score ────────────────────────────────────────────────────────────

function _stdDev(arr) {
  if (arr.length < 2) return 0
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - avg) ** 2, 0) / arr.length)
}

export function calcQualityScore(habit, userData) {
  const sid = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const freq = habit.frequency || 1
  const today = new Date()
  const DAYS = 60

  let appearances = 0, completions = 0, habitPts = 0, allPts = 0
  let recentDone = 0, recentApps = 0, oldDone = 0, oldApps = 0
  const gaps = []
  let lastDoneIdx = null

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])

    // All points that day
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) {
        const isM = getItemValueAtDate(h, 'isMulti', ds)
        const rMin = getItemValueAtDate(h, 'rewardMin', ds)
        const rMax = getItemValueAtDate(h, 'reward', ds)
        const lvl = entry.habitLevels[hId] || 'max'
        allPts += isM && lvl === 'min' ? rMin : rMax
      }
    })

    // Is this habit visible on this day?
    const created = habit.changes?.[0]?.date || '2020-01-01'
    if (ds < created) continue
    if (habit.archivedAt && ds >= habit.archivedAt) continue
    if (habit.type === 'single' && habit.targetDate !== ds) continue
    if (freq > 1 && !entry.habits.includes(sid) && !entry.failedHabits.includes(sid)) {
      // Check frequency skip — approximate: only count every freq days
      if (i % freq !== 0) continue
    }

    appearances++
    const half = DAYS / 2
    if (i < half) { recentApps++ } else { oldApps++ }

    if (entry.habits.includes(sid)) {
      completions++
      if (i < half) { recentDone++ } else { oldDone++ }
      const isM = getItemValueAtDate(habit, 'isMulti', ds)
      const rMin = getItemValueAtDate(habit, 'rewardMin', ds)
      const rMax = getItemValueAtDate(habit, 'reward', ds)
      const lvl = entry.habitLevels[sid] || 'max'
      habitPts += isM && lvl === 'min' ? rMin : rMax
      if (lastDoneIdx !== null) gaps.push(lastDoneIdx - i)
      lastDoneIdx = i
    }
  }

  if (appearances < 3) return 50 // not enough data — neutral

  const winRate = completions / appearances
  const consistency = gaps.length > 1 ? Math.max(0, 1 - _stdDev(gaps) / (freq + 1)) : (completions > 0 ? 0.5 : 0)
  const impact = allPts > 0 ? Math.min(habitPts / allPts, 1) : 0
  const recentWR = recentApps > 0 ? recentDone / recentApps : winRate
  const oldWR = oldApps > 0 ? oldDone / oldApps : winRate
  const trend = oldWR > 0 ? Math.min(recentWR / oldWR, 2) / 2 : 0.5

  return Math.max(0, Math.min(100, Math.round(winRate * 40 + consistency * 30 + impact * 20 + trend * 10)))
}

export function qualityLabel(score) {
  if (score >= 80) return { text: 'Eccellente 💪', color: 'var(--success)' }
  if (score >= 60) return { text: 'Buona', color: '#69f0ae' }
  if (score >= 40) return { text: 'Da migliorare', color: '#EF9F27' }
  return { text: 'Critica', color: 'var(--danger)' }
}

// ─── Life Map (radar data per category) ──────────────────────────────────────

export function buildLifeMap(userData, days = 30) {
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  const tagStats = {} // tagId → { done, appeared }
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])

    ;(userData?.habits || []).forEach(h => {
      if (h.type === 'goal' || h.archivedAt) return
      const created = h.changes?.[0]?.date || '2020-01-01'
      if (ds < created) return
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      const tag = h.tagId || '__none__'
      if (!tagStats[tag]) tagStats[tag] = { done: 0, appeared: 0, name: tagsMap[tag]?.name || 'Nessuna', color: tagsMap[tag]?.color || '#555', emoji: tagsMap[tag]?.emoji || '', icon: tagsMap[tag]?.icon || '' }
      tagStats[tag].appeared++
      if (entry.habits.includes(sid)) tagStats[tag].done++
    })
  }

  return Object.keys(tagStats).map(id => ({
    id,
    name: tagStats[id].name,
    color: tagStats[id].color,
    emoji: tagStats[id].emoji,
    winRate: tagStats[id].appeared > 0 ? Math.round((tagStats[id].done / tagStats[id].appeared) * 100) : 0,
  })).filter(t => t.id !== '__none__').sort((a, b) => b.winRate - a.winRate)
}

// ─── Cause-Effect ─────────────────────────────────────────────────────────────

// Mood → win rate (for each mood level 1-5, average % habits completed)
export function buildMoodToWinRate(userData, userId, days = 60) {
  const today = new Date()
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] }

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    const mood = entry.mood?.[userId]?.value
    if (!mood) continue

    const active = (userData?.habits || []).filter(h => {
      if (h.type === 'goal' || h.archivedAt) return false
      const created = h.changes?.[0]?.date || '2020-01-01'
      return ds >= created
    })
    if (active.length === 0) continue

    const winRate = active.filter(h => {
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      return entry.habits.includes(sid)
    }).length / active.length * 100

    buckets[mood].push(winRate)
  }

  return [1, 2, 3, 4, 5].map(v => ({
    mood: v,
    avgWinRate: buckets[v].length ? Math.round(buckets[v].reduce((a, b) => a + b, 0) / buckets[v].length) : null,
    count: buckets[v].length,
  }))
}

// For each habit: avg mood on completed days vs non-completed days
export function buildHabitToMood(userData, userId, days = 60) {
  const today = new Date()
  const habitMoods = {} // sid → { doneMoods, notDoneMoods }

  ;(userData?.habits || []).filter(h => !h.archivedAt && h.type !== 'goal').forEach(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    habitMoods[sid] = { name: h.name, done: [], notDone: [] }
  })

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    const mood = entry.mood?.[userId]?.value
    if (!mood) continue

    Object.keys(habitMoods).forEach(sid => {
      if (entry.habits.includes(sid)) {
        habitMoods[sid].done.push(mood)
      } else {
        habitMoods[sid].notDone.push(mood)
      }
    })
  }

  return Object.keys(habitMoods)
    .map(sid => {
      const d = habitMoods[sid].done
      const nd = habitMoods[sid].notDone
      const avgDone = d.length > 0 ? d.reduce((a, b) => a + b, 0) / d.length : null
      const avgNotDone = nd.length > 0 ? nd.reduce((a, b) => a + b, 0) / nd.length : null
      const diff = avgDone !== null && avgNotDone !== null ? avgDone - avgNotDone : null
      return {
        sid, name: habitMoods[sid].name,
        avgDone: avgDone !== null ? Math.round(avgDone * 10) / 10 : null,
        avgNotDone: avgNotDone !== null ? Math.round(avgNotDone * 10) / 10 : null,
        diff: diff !== null ? Math.round(diff * 10) / 10 : null,
        doneCount: d.length,
        notDoneCount: nd.length,
      }
    })
    .filter(x => x.diff !== null && Math.abs(x.diff) >= 0.5 && x.doneCount >= 5)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

// Co-occurrence matrix for habits (top N habits)
export function buildHabitCoMatrix(userData, days = 60, topN = 8) {
  const today = new Date()
  const activeHabits = (userData?.habits || [])
    .filter(h => !h.archivedAt && h.type !== 'goal')
    .slice(0, topN)

  const matrix = {} // sid_a → { sid_b → { both, onlyA } }
  activeHabits.forEach(ha => {
    const sidA = ha.id || ha.name.replace(/[^a-zA-Z0-9]/g, '')
    matrix[sidA] = {}
    activeHabits.forEach(hb => {
      const sidB = hb.id || hb.name.replace(/[^a-zA-Z0-9]/g, '')
      if (sidA === sidB) return
      matrix[sidA][sidB] = { both: 0, onlyA: 0 }
    })
  })

  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    const entry = parseEntry(userData?.dailyLogs?.[ds])
    const doneSet = new Set(entry.habits)

    activeHabits.forEach(ha => {
      const sidA = ha.id || ha.name.replace(/[^a-zA-Z0-9]/g, '')
      if (!doneSet.has(sidA)) return
      activeHabits.forEach(hb => {
        const sidB = hb.id || hb.name.replace(/[^a-zA-Z0-9]/g, '')
        if (sidA === sidB || !matrix[sidA]?.[sidB]) return
        matrix[sidA][sidB].onlyA++
        if (doneSet.has(sidB)) matrix[sidA][sidB].both++
      })
    })
  }

  return {
    habits: activeHabits.map(h => ({ sid: h.id || h.name.replace(/[^a-zA-Z0-9]/g, ''), name: h.name })),
    matrix,
  }
}

// ─── Quality ranking ──────────────────────────────────────────────────────────

export function buildQualityRanking(userData) {
  return (userData?.habits || [])
    .filter(h => !h.archivedAt && h.type !== 'goal' && h.type !== 'if')
    .map(h => ({ habit: h, score: calcQualityScore(h, userData) }))
    .sort((a, b) => b.score - a.score)
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

// ─── Momentum Score History (daily scores) ────────────────────────────────────
export function buildMomentumScoreHistory(userData, days = 30) {
  const today = new Date()
  const dailyLogs = userData?.dailyLogs || {}
  const habits = userData?.habits || []

  function netAt(d) {
    const ds = toDateString(d)
    const entry = parseEntry(dailyLogs[ds])
    let net = 0
    entry.habits.forEach(hId => {
      const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) net += getItemValueAtDate(h, 'reward', ds)
    })
    entry.failedHabits.forEach(hId => {
      const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (h) net -= getItemValueAtDate(h, 'penalty', ds)
    })
    return net
  }

  function momentumAt(refDate) {
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(refDate); d.setDate(refDate.getDate() - i); return netAt(d) })
    const prev7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(refDate); d.setDate(refDate.getDate() - 7 - i); return netAt(d) })
    const last30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(refDate); d.setDate(refDate.getDate() - i); return netAt(d) })
    const avgLast7 = last7.reduce((a, b) => a + b, 0) / 7
    const avgPrev7 = prev7.reduce((a, b) => a + b, 0) / 7
    const trend7 = avgPrev7 !== 0 ? Math.min(avgLast7 / Math.abs(avgPrev7), 2) : avgLast7 > 0 ? 1.5 : 0.5
    let streak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date(refDate); d.setDate(refDate.getDate() - i)
      const entry = parseEntry(dailyLogs[toDateString(d)])
      if (entry.habits.length > 0) streak++; else break
    }
    const streakScore = Math.min(streak / 30, 1)
    const avg30 = last30.reduce((a, b) => a + b, 0) / 30
    const daysAboveAvg = last7.filter(v => v >= avg30).length
    const stdDev = Math.sqrt(last30.reduce((acc, v) => acc + (v - avg30) ** 2, 0) / 30)
    const consistency = avg30 > 0 ? Math.max(0, Math.min(1 - stdDev / avg30, 1)) : 0
    return Math.max(0, Math.min(100, Math.round(trend7 * 35 + streakScore * 30 + (daysAboveAvg / 7) * 20 + consistency * 15)))
  }

  return Array.from({ length: days }, (_, i) => {
    const refDate = new Date(today); refDate.setDate(today.getDate() - (days - 1 - i))
    return { label: `${refDate.getDate()}/${refDate.getMonth() + 1}`, score: momentumAt(refDate) }
  })
}

// ─── Life Timeline ────────────────────────────────────────────────────────────
const MONTH_NAMES_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export function getMonthColor(avgDaily) {
  if (avgDaily >= 15) return 'excellent'
  if (avgDaily >= 8)  return 'good'
  if (avgDaily >= 3)  return 'normal'
  if (avgDaily >= 0)  return 'difficult'
  return 'negative'
}

export function buildLifeTimeline(userData) {
  const dailyLogs = userData?.dailyLogs || {}
  const habits = userData?.habits || []
  const dates = Object.keys(dailyLogs).sort()
  if (dates.length === 0) return []

  const firstDate = new Date(dates[0])
  const today = new Date()
  const months = []
  let cur = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)

  while (cur <= today) {
    const year = cur.getFullYear()
    const month = cur.getMonth()
    const mm = String(month + 1).padStart(2, '0')
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    let totalNet = 0, moodSum = 0, moodCount = 0, maxStreak = 0, tempStreak = 0, daysWithData = 0
    const mostDone = {}, mostFailed = {}

    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0')
      const dateStr = `${year}-${mm}-${dd}`
      const raw = dailyLogs[dateStr]
      if (!raw) { tempStreak = 0; continue }
      daysWithData++

      const entry = parseEntry(raw)
      let dayNet = 0

      entry.habits.forEach(hId => {
        mostDone[hId] = (mostDone[hId] || 0) + 1
        const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) {
          const isM = getItemValueAtDate(h, 'isMulti', dateStr)
          const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
          const rMax = getItemValueAtDate(h, 'reward', dateStr)
          const lvl = entry.habitLevels[hId] || 'max'
          dayNet += isM && lvl === 'min' ? rMin : rMax
        }
      })
      entry.failedHabits.forEach(hId => {
        mostFailed[hId] = (mostFailed[hId] || 0) + 1
        const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) dayNet -= getItemValueAtDate(h, 'penalty', dateStr)
      })
      dayNet -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
      totalNet += dayNet

      const moodVals = entry.mood ? Object.values(entry.mood) : []
      if (moodVals.length > 0 && moodVals[0]?.value) { moodSum += moodVals[0].value; moodCount++ }

      if (dayNet > 0) { tempStreak++; if (tempStreak > maxStreak) maxStreak = tempStreak }
      else tempStreak = 0
    }

    const avgDaily = daysWithData > 0 ? Math.round((totalNet / daysWithData) * 10) / 10 : 0
    const avgMood = moodCount > 0 ? moodSum / moodCount : null
    const moodEmoji = avgMood ? ['', '😞', '😕', '😐', '😊', '🤩'][Math.round(avgMood)] : null

    const topDoneId = Object.keys(mostDone).length > 0 ? Object.keys(mostDone).reduce((a, b) => mostDone[a] > mostDone[b] ? a : b) : null
    const topFailedId = Object.keys(mostFailed).length > 0 ? Object.keys(mostFailed).reduce((a, b) => mostFailed[a] > mostFailed[b] ? a : b) : null
    const topDoneName = topDoneId ? (habits.find(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === topDoneId)?.name || null) : null
    const topFailedName = topFailedId ? (habits.find(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === topFailedId)?.name || null) : null

    months.push({
      year, month,
      label: MONTH_NAMES_IT[month] + ' ' + year,
      totalNet, avgDaily, daysWithData,
      moodEmoji, avgMood, maxStreak,
      topDoneName, topFailedName,
      colorClass: getMonthColor(avgDaily),
      isCurrentMonth: year === today.getFullYear() && month === today.getMonth(),
    })

    cur.setMonth(cur.getMonth() + 1)
  }

  return months
}

// ─── Annual Heatmap ───────────────────────────────────────────────────────────
export function buildAnnualHeatmap(userData, year) {
  const dailyLogs = userData?.dailyLogs || {}
  const habits = userData?.habits || []
  const today = new Date()
  const cells = []

  // Start from Monday of first week of year
  const jan1 = new Date(year, 0, 1)
  // Find the Monday on or before Jan 1 (ISO week starts Mon)
  const startDow = (jan1.getDay() + 6) % 7 // 0=Mon..6=Sun
  const start = new Date(jan1)
  start.setDate(jan1.getDate() - startDow)

  const d = new Date(start)
  // Iterate 53 weeks max
  for (let w = 0; w < 53; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = toDateString(d)
      const inYear = d.getFullYear() === year
      const inFuture = d > today

      if (!inYear || inFuture) {
        cells.push({ dateStr, net: 0, hasData: false, dow, month: d.getMonth(), day: d.getDate(), week: w, inYear, completed: 0, failed: 0, mood: null })
      } else {
        const raw = dailyLogs[dateStr]
        if (!raw) {
          cells.push({ dateStr, net: 0, hasData: false, dow, month: d.getMonth(), day: d.getDate(), week: w, inYear: true, completed: 0, failed: 0, mood: null })
        } else {
          const entry = parseEntry(raw)
          let net = 0
          entry.habits.forEach(hId => {
            const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
            if (h) {
              const isM = getItemValueAtDate(h, 'isMulti', dateStr)
              const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
              const rMax = getItemValueAtDate(h, 'reward', dateStr)
              const lvl = entry.habitLevels[hId] || 'max'
              net += isM && lvl === 'min' ? rMin : rMax
            }
          })
          entry.failedHabits.forEach(hId => {
            const h = habits.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
            if (h) net -= getItemValueAtDate(h, 'penalty', dateStr)
          })
          net -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)

          const moodVals = entry.mood ? Object.values(entry.mood) : []
          const mood = moodVals.length > 0 ? moodVals[0]?.value : null

          cells.push({ dateStr, net, hasData: true, dow, month: d.getMonth(), day: d.getDate(), week: w, inYear: true, completed: entry.habits.length, failed: entry.failedHabits.length, mood })
        }
      }
      d.setDate(d.getDate() + 1)
    }
  }

  return cells
}

