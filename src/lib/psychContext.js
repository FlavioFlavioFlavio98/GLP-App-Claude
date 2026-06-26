import { parseEntry, toDateString, getItemValueAtDate, isHabitVisible } from './habitLogic'
import { getLevel } from './levels'

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return toDateString(d)
  })
}

function getDailyNetSimple(userData, rawEntry, dateStr) {
  if (!rawEntry) return 0
  const entry = parseEntry(rawEntry)
  let net = 0
  ;(entry.habits || []).forEach(hId => {
    const h = (userData.habits || []).find(x => (x.id || x.name?.replace(/[^a-zA-Z0-9]/g,'')) === hId)
    if (h) net += getItemValueAtDate(h, 'reward', dateStr) || 0
  })
  ;(entry.failedHabits || []).forEach(hId => {
    const h = (userData.habits || []).find(x => (x.id || x.name?.replace(/[^a-zA-Z0-9]/g,'')) === hId)
    if (h) net -= getItemValueAtDate(h, 'penalty', dateStr) || 0
  })
  ;(entry.purchases || []).forEach(p => { net -= parseInt(p.cost || 0) })
  return Math.round(net * 10) / 10
}

function calcWinRate(habit, dailyLogs) {
  const habitId = habit.id || habit.name?.replace(/[^a-zA-Z0-9]/g, '')
  const dates = Object.keys(dailyLogs || {})
  const appearances = dates.filter(d => isHabitVisible(habit, d, [], [])).length
  if (appearances === 0) return 0
  const completions = dates.filter(d => {
    const entry = parseEntry(dailyLogs[d])
    return entry.habits.includes(habitId)
  }).length
  return completions / appearances
}

function calcGlobalStreak(dailyLogs) {
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateString(d)
    const entry = parseEntry(dailyLogs[dateStr])
    if (entry.habits.length > 0) streak++
    else if (i > 0) break
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function buildGlpContext(userData, dailyLogs) {
  const last7 = getLast7Days()
  const nets = last7.map(d => getDailyNetSimple(userData, dailyLogs[d], d))
  const moods = last7.map(d => dailyLogs[d]?.mood?.flavio?.value).filter(Boolean)

  const lowWinRate = (userData.habits || [])
    .filter(h => !h.archivedAt)
    .map(h => ({ name: h.name, wr: calcWinRate(h, dailyLogs) }))
    .filter(h => h.wr < 0.5 && h.wr > 0)
    .map(h => h.name)

  const levelInfo = getLevel(userData.score || 0)

  return {
    last7DaysNet: nets.reduce((a, b) => a + b, 0).toFixed(1),
    recentMoodAvg: moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null,
    lowWinRateHabits: lowWinRate,
    currentStreak: calcGlobalStreak(dailyLogs),
    level: levelInfo.name,
  }
}
