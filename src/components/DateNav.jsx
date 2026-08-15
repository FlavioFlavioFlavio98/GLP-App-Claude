import { useApp } from '../lib/store'
import { formatDisplayDate, toDateString } from '../lib/habitLogic'

export default function DateNav() {
  const { state, actions } = useApp()
  const { viewDate } = state

  function changeDate(days) {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + days)
    actions.setViewDate(toDateString(d))
  }

  return (
    <div className="date-nav">
      <button className="date-btn" onClick={() => changeDate(-1)}>&#8249;</button>
      <div className="current-date-wrapper">
        <span className="current-date">{formatDisplayDate(viewDate)}</span>
        <input
          type="date"
          className="date-picker-overlay"
          value={viewDate}
          onChange={e => e.target.value && actions.setViewDate(e.target.value)}
        />
      </div>
      <button className="date-btn" onClick={() => changeDate(1)}>&#8250;</button>
    </div>
  )
}
