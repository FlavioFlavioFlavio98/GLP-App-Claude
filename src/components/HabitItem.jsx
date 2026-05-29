import { useApp } from '../lib/store'
import { getItemValueAtDate, calculateStreak, toDateString } from '../lib/habitLogic'

export default function HabitItem({ habit, viewDate, doneHabits, failedHabits, habitLevels, tagsMap, isToday }) {
  const { actions } = useApp()
  const stableId = habit.id || habit.name.replace(/[^a-zA-Z0-9]/g, '')
  const isDone = doneHabits.includes(stableId)
  const isFailed = failedHabits.includes(stableId)
  const level = habitLevels[stableId] || 'max'

  const reward = getItemValueAtDate(habit, 'reward', viewDate)
  const rewardMin = getItemValueAtDate(habit, 'rewardMin', viewDate)
  const penalty = getItemValueAtDate(habit, 'penalty', viewDate)
  const isMulti = getItemValueAtDate(habit, 'isMulti', viewDate)
  const description = getItemValueAtDate(habit, 'description', viewDate)
  const isIf = habit.type === 'if'

  const tag = tagsMap[habit.tagId]
  const streak = isToday && !isIf ? calculateStreak(stableId, {}) : 0

  // Done button appearance
  let doneClass = 'done-btn'
  let doneContent = <span className="material-icons-round">check</span>
  if (isDone) {
    if (isMulti && level === 'min') {
      doneClass = 'done-btn min-level'
      doneContent = 'MIN'
    } else {
      doneClass = 'done-btn active'
      doneContent = isMulti ? 'MAX' : <span className="material-icons-round">check</span>
    }
  }

  const statusClass = isDone ? 'status-done' : isFailed ? 'status-failed' : ''

  return (
    <div className={`item ${statusClass}`} style={tag ? { borderLeftColor: tag.color } : {}}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="item-name-row">
          <h3>{habit.name}</h3>
          {tag && <span className="tag-pill" style={{ background: tag.color }}>{tag.name}</span>}
          {streak > 1 && <span className="streak-badge">🔥 {streak}</span>}
        </div>
        {description ? <span className="item-desc">{description}</span> : null}
        <div className="vals">
          <span className={`val-badge val-badge-plus`}>
            +{isMulti ? `${rewardMin}/${reward}` : reward}
          </span>
          {!isIf && <> / <span className={`val-badge val-badge-minus`}>-{penalty}</span></>}
        </div>
      </div>
      <div className="actions-group">
        <button className="btn-icon" onClick={() => actions.openModal('singleHabit', habit.id)}>
          <span className="material-icons-round" style={{ fontSize: 18 }}>insights</span>
        </button>
        <button className="btn-icon" onClick={() => actions.openModal('edit', { id: habit.id, type: 'habit' })}>
          <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
        </button>
        {!isIf && (
          <button
            className={`btn-status fail-btn${isFailed ? ' active' : ''}`}
            onClick={() => actions.setHabitStatus(stableId, 'failed')}
          >
            <span className="material-icons-round">close</span>
          </button>
        )}
        <button
          className={`btn-status ${doneClass}`}
          onClick={() => actions.setHabitStatus(stableId, 'next')}
        >
          {doneContent}
        </button>
      </div>
    </div>
  )
}
