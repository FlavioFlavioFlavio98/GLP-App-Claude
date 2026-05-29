import { useApp } from '../lib/store'
import { parseEntry, getItemValueAtDate, toDateString } from '../lib/habitLogic'

export default function SingleHabitView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData, currentUser } = state

  if (modal !== 'singleHabit' || !globalData) return null

  const habitId = modalPayload
  const habit = globalData.habits?.find(h => h.id === habitId || h.name === habitId)
  if (!habit) return null

  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')

  let totalDone = 0, totalFail = 0, bestStreak = 0, tempStreak = 0
  const datesMap = {}
  const today = new Date()

  const sortedDates = Object.keys(globalData.dailyLogs || {}).sort()
  sortedDates.forEach(dateStr => {
    const entry = parseEntry(globalData.dailyLogs[dateStr])
    const isDone = entry.habits.includes(stableId)
    const isFail = entry.failedHabits.includes(stableId)
    if (isDone) {
      totalDone++; tempStreak++; datesMap[dateStr] = 'done'
    } else {
      if (isFail) { totalFail++; datesMap[dateStr] = 'fail' }
      if (tempStreak > bestStreak) bestStreak = tempStreak
      tempStreak = 0
    }
  })
  if (tempStreak > bestStreak) bestStreak = tempStreak

  const totalAttempts = totalDone + totalFail
  const winRate = totalAttempts > 0 ? Math.round((totalDone / totalAttempts) * 100) : 0

  let totalPoints = 0
  sortedDates.forEach(dateStr => {
    if (datesMap[dateStr] === 'done') {
      const entry = parseEntry(globalData.dailyLogs[dateStr])
      const isM = getItemValueAtDate(habit, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(habit, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(habit, 'reward', dateStr)
      const lvl = entry.habitLevels[stableId] || 'max'
      totalPoints += isM && lvl === 'min' ? rMin : rMax
    }
  })

  // Generate last 60 days
  const heatDots = []
  const trendDots = []
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = toDateString(d)
    const status = datesMap[key] || 'empty'
    heatDots.push({ key, status })
    if (i < 10) trendDots.push({ key, status })
  }

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2em', color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Analisi: {habit.name}
        </h1>
      </div>

      <div className="single-habit-body">
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-num" style={{ color: 'var(--success)' }}>{totalDone}</span>
            <span className="stat-lbl">Volte Fatto</span>
          </div>
          <div className="stat-box">
            <span className="stat-num" style={{ color: winRate >= 80 ? '#4caf50' : '#ffca28' }}>{winRate}%</span>
            <span className="stat-lbl">Win Rate</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{bestStreak}</span>
            <span className="stat-lbl">Best Streak</span>
          </div>
          <div className="stat-box">
            <span className="stat-num" style={{ color: 'var(--theme-color)' }}>{totalPoints}</span>
            <span className="stat-lbl">Punti Generati</span>
          </div>
        </div>

        <div className="trend-container">
          <span className="stat-lbl" style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.7em' }}>Ultimi 10 Giorni</span>
          <div className="trend-dots">
            {trendDots.map(({ key, status }) => (
              <div key={key} className={`trend-dot st-${status}`} />
            ))}
          </div>
        </div>

        <div className="heatmap-container">
          <span className="stat-lbl" style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.7em' }}>Ultimi 2 Mesi</span>
          <div className="heatmap-grid">
            {heatDots.map(({ key, status }) => (
              <div key={key} className={`heat-box st-${status}`} title={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
