import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString } from './habitLogic'
import { getLevel } from './levels'

function getLast90Days() {
  const days = []
  const today = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(toDateString(d))
  }
  return days
}

function getDailyNet(userData, rawEntry, dateStr) {
  const entry = parseEntry(rawEntry)
  let net = 0
  entry.habits.forEach(hId => {
    const h = (userData.habits || []).find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) {
      const isM = getItemValueAtDate(h, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(h, 'reward', dateStr)
      const lvl = entry.habitLevels[hId] || 'max'
      net += isM && lvl === 'min' ? rMin : rMax
    }
  })
  entry.failedHabits.forEach(hId => {
    const h = (userData.habits || []).find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
    if (h) net -= getItemValueAtDate(h, 'penalty', dateStr)
  })
  net -= entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  return Math.round(net * 10) / 10
}

function calculateStreak(habit, dailyLogs) {
  const today = toDateString(new Date())
  const habitId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  let streak = 0
  let d = new Date()
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateString(d)
    if (!isHabitVisible(habit, dateStr, [], [])) { d.setDate(d.getDate() - 1); continue }
    const entry = parseEntry(dailyLogs[dateStr])
    if (entry.habits.includes(habitId)) {
      streak++
    } else if (dateStr < today) {
      break
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function calculateGlobalStreak(dailyLogs) {
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateString(d)
    const entry = parseEntry(dailyLogs[dateStr])
    if (entry.habits.length > 0) {
      streak++
    } else if (i > 0) {
      break
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function buildCoachContext(userData, dailyLogs, tags) {
  const today = new Date()
  const todayStr = toDateString(today)
  const allDates = Object.keys(dailyLogs || {}).sort()

  const habitStats = (userData.habits || [])
    .filter(h => !h.archivedAt)
    .map(habit => {
      const habitId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
      const appearances = allDates.filter(d => isHabitVisible(habit, d, [], [])).length
      const completions = allDates.filter(d => {
        const entry = dailyLogs[d]
        const done = Array.isArray(entry) ? entry : (entry?.habits || [])
        return done.includes(habitId)
      }).length
      const failures = allDates.filter(d => {
        const entry = dailyLogs[d]
        const failed = Array.isArray(entry) ? [] : (entry?.failedHabits || [])
        return failed.includes(habitId)
      }).length

      const tag = (tags || []).find(t => t.id === habit.tag || t.id === habit.tagId)
      return {
        name: habit.name,
        tag: tag?.name || 'Nessuna categoria',
        importance: habit.importance || 'medium',
        why: habit.why || null,
        winRate: appearances > 0 ? Math.round(completions / appearances * 100) : 0,
        completions,
        failures,
        appearances,
        currentStreak: calculateStreak(habit, dailyLogs),
        reward: getItemValueAtDate(habit, 'reward', todayStr),
        penalty: getItemValueAtDate(habit, 'penalty', todayStr),
      }
    })

  const last90Days = getLast90Days().map(date => {
    const rawEntry = (dailyLogs || {})[date] || {}
    const entry = parseEntry(rawEntry)
    return {
      date,
      net: getDailyNet(userData, rawEntry, date),
      mood: entry.mood?.['flavio']?.value ?? null,
      moodNote: entry.mood?.['flavio']?.note ?? null,
      energy: entry.energy?.['flavio'] ?? null,
      habitsCompleted: entry.habits.length,
      habitsFailed: entry.failedHabits.length,
    }
  })

  const categoryStats = (tags || []).map(tag => {
    const tagHabits = habitStats.filter(h => h.tag === tag.name)
    const avgWinRate = tagHabits.length > 0
      ? Math.round(tagHabits.reduce((s, h) => s + h.winRate, 0) / tagHabits.length)
      : 0
    return { name: tag.name, avgWinRate, habitCount: tagHabits.length }
  })

  const recentJournal = Object.entries(userData.journalEntries || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10)
    .map(([date, entry]) => ({ date, question: entry.question, answer: entry.answer }))

  const recentPurchases = Object.entries(dailyLogs || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30)
    .flatMap(([date, entry]) => {
      const purchases = Array.isArray(entry) ? [] : (entry?.purchases || [])
      return purchases.map(p => ({
        date,
        rewardName: (userData.rewards || []).find(r => r.id === p)?.name || (p?.name || p),
      }))
    })

  const levelInfo = getLevel(userData.score || 0)

  return {
    user: 'Flavio',
    currentDate: todayStr,
    totalScore: userData.score || 0,
    level: { number: levelInfo.level, name: levelInfo.name },
    currentStreak: calculateGlobalStreak(dailyLogs),
    last90Days,
    habitStats: habitStats.sort((a, b) => b.winRate - a.winRate),
    categoryStats,
    recentJournal,
    recentPurchases,
    goals: (userData.habits || []).filter(h => h.type === 'goal').map(g => ({
      name: g.name,
      current: g.goalConfig?.currentValue,
      target: g.goalConfig?.targetValue,
      deadline: g.goalConfig?.deadline,
      unit: g.goalConfig?.unit,
    })),
    quickExercises: {
      totalReps: Object.values(userData.exerciseLog || {})
        .flat()
        .reduce((sum, s) => sum + (s.reps || 0), 0),
    },
    weightLog: userData.weightLog || {},
    activeTasks: (userData.tasks || [])
      .filter(t => t.status === 'active')
      .map(t => ({
        title: t.title,
        deadline: t.deadline,
        reward: t.reward,
        penalty: t.penalty,
        priority: t.priority,
        daysLeft: Math.ceil((new Date(t.deadline) - new Date()) / 86400000),
      })),
  }
}
