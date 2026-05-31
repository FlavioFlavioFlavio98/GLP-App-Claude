import { parseEntry, getItemValueAtDate, toDateString } from './habitLogic'

// Helper: get all date strings from user's dailyLogs (sorted)
function getSortedDates(userData) {
  return Object.keys(userData?.dailyLogs || {}).sort()
}

// Check if we have enough data (at least minDays of actual logs)
export function hasEnoughData(userData, minDays = 14) {
  return getSortedDates(userData).length >= minDays
}

// Build a map: habitId → { done: Set<dateStr>, failed: Set<dateStr>, name }
function buildHabitDaysMap(userData) {
  const map = {}
  ;(userData?.habits || []).forEach(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    map[sid] = { done: new Set(), failed: new Set(), name: h.name, tagId: h.tagId }
  })
  getSortedDates(userData).forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    entry.habits.forEach(hId => { if (map[hId]) map[hId].done.add(dateStr) })
    entry.failedHabits.forEach(hId => { if (map[hId]) map[hId].failed.add(dateStr) })
  })
  return map
}

// Calculate Pearson-like co-occurrence for two habits (failure correlation)
function coOccurrenceRate(setA, setB, totalDaysA) {
  if (totalDaysA === 0) return 0
  let count = 0
  setA.forEach(d => { if (setB.has(d)) count++ })
  return count / totalDaysA
}

// 1. Habit failure correlations ("quando fallisci A spesso fallisci B")
export function buildFailureCorrelations(userData, minRate = 0.6, topN = 4) {
  const daysMap = buildHabitDaysMap(userData)
  const habits = Object.keys(daysMap)
  const results = []

  for (let i = 0; i < habits.length; i++) {
    for (let j = 0; j < habits.length; j++) {
      if (i === j) continue
      const a = habits[i], b = habits[j]
      const failA = daysMap[a].failed
      if (failA.size < 3) continue
      const rate = coOccurrenceRate(failA, daysMap[b].failed, failA.size)
      if (rate >= minRate) {
        results.push({ a: daysMap[a].name, b: daysMap[b].name, rate: Math.round(rate * 100) })
      }
    }
  }
  return results.sort((a, b) => b.rate - a.rate).slice(0, topN)
}

// 2. Habit done correlations ("quando completi A tendi a completare B")
export function buildDoneCorrelations(userData, minRate = 0.65, topN = 4) {
  const daysMap = buildHabitDaysMap(userData)
  const habits = Object.keys(daysMap)
  const results = []

  for (let i = 0; i < habits.length; i++) {
    for (let j = 0; j < habits.length; j++) {
      if (i === j) continue
      const a = habits[i], b = habits[j]
      const doneA = daysMap[a].done
      if (doneA.size < 5) continue
      const rate = coOccurrenceRate(doneA, daysMap[b].done, doneA.size)
      if (rate >= minRate) {
        results.push({ a: daysMap[a].name, b: daysMap[b].name, rate: Math.round(rate * 100) })
      }
    }
  }
  return results.sort((a, b) => b.rate - a.rate).slice(0, topN)
}

// 3. Best day of week (average net by DOW)
export function buildDayOfWeekPattern(userData) {
  const DOW_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const buckets = [[], [], [], [], [], [], []]
  getSortedDates(userData).forEach(dateStr => {
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
    net -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)
    const dow = new Date(dateStr).getDay()
    buckets[dow].push(net)
  })
  const avgs = buckets.map(b => b.length ? b.reduce((a, c) => a + c, 0) / b.length : 0)
  const bestIdx = avgs.indexOf(Math.max(...avgs))
  const worstIdx = avgs.indexOf(Math.min(...avgs))
  return {
    bestDay: DOW_IT[bestIdx],
    bestAvg: Math.round(avgs[bestIdx]),
    worstDay: DOW_IT[worstIdx],
    worstAvg: Math.round(avgs[worstIdx]),
    avgs: DOW_IT.map((d, i) => ({ day: d, avg: Math.round(avgs[i]) })),
  }
}

// 4. Trend last 30 vs prior 30
export function buildTrend30(userData) {
  const today = new Date()
  let recent = 0, prev = 0, recentDays = 0, prevDays = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    if (userData?.dailyLogs?.[ds] !== undefined) {
      const entry = parseEntry(userData.dailyLogs[ds])
      let net = 0
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) net += getItemValueAtDate(h, 'reward', ds)
      })
      entry.failedHabits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) net -= getItemValueAtDate(h, 'penalty', ds)
      })
      net -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)
      recent += net; recentDays++
    }
  }
  for (let i = 30; i < 60; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const ds = toDateString(d)
    if (userData?.dailyLogs?.[ds] !== undefined) {
      const entry = parseEntry(userData.dailyLogs[ds])
      let net = 0
      entry.habits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) net += getItemValueAtDate(h, 'reward', ds)
      })
      entry.failedHabits.forEach(hId => {
        const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
        if (h) net -= getItemValueAtDate(h, 'penalty', ds)
      })
      net -= entry.purchases.reduce((a, p) => a + parseInt(p.cost || 0), 0)
      prev += net; prevDays++
    }
  }
  const recentAvg = recentDays > 0 ? recent / recentDays : 0
  const prevAvg = prevDays > 0 ? prev / prevDays : 0
  const pct = prevAvg !== 0 ? Math.round(((recentAvg - prevAvg) / Math.abs(prevAvg)) * 100) : 0
  let direction = 'stabile'
  if (pct > 10) direction = 'crescita'
  else if (pct < -10) direction = 'calo'
  return { recentAvg: Math.round(recentAvg), prevAvg: Math.round(prevAvg), pct, direction }
}

// 5. Critical habits
export function buildCriticalHabits(userData) {
  const daysMap = buildHabitDaysMap(userData)
  const totalDays = getSortedDates(userData).length
  if (totalDays === 0) return { highest: null, lowestWinRate: null, lowWinRateCount: 0 }

  // Total potential daily points
  const activeHabits = (userData?.habits || []).filter(h => !h.archivedAt && h.type !== 'if')
  const totalPotential = activeHabits.reduce((acc, h) => acc + (h.reward || 0), 0)

  // Habit with highest reward (most impact)
  let highest = null, highestPct = 0
  activeHabits.forEach(h => {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const pct = totalPotential > 0 ? Math.round((h.reward / totalPotential) * 100) : 0
    if (pct > highestPct) { highestPct = pct; highest = { name: h.name, pct } }
  })

  // Habits with lowest win rate
  const withRates = Object.keys(daysMap).map(sid => {
    const m = daysMap[sid]
    const attempts = m.done.size + m.failed.size
    const winRate = attempts > 0 ? Math.round((m.done.size / attempts) * 100) : null
    return { name: m.name, winRate, attempts }
  }).filter(x => x.attempts >= 5 && x.winRate !== null).sort((a, b) => a.winRate - b.winRate)

  const lowestWinRate = withRates[0] || null
  const lowCount = withRates.filter(x => x.winRate < 50).length

  return { highest, lowestWinRate, lowWinRateCount: lowCount }
}

// 6. Category balance
export function buildCategoryBalance(userData) {
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })
  const scores = {}
  getSortedDates(userData).forEach(dateStr => {
    const entry = parseEntry(userData.dailyLogs[dateStr])
    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return
      const pts = getItemValueAtDate(h, 'reward', dateStr)
      const tag = h.tagId || '__none__'
      scores[tag] = (scores[tag] || 0) + pts
    })
  })
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.keys(scores).map(tId => ({
    name: tId === '__none__' ? 'Senza categoria' : (tagsMap[tId]?.name || '?'),
    color: tId === '__none__' ? '#555' : (tagsMap[tId]?.color || '#888'),
    pts: scores[tId],
    pct: Math.round((scores[tId] / total) * 100),
  })).sort((a, b) => b.pct - a.pct)
}
