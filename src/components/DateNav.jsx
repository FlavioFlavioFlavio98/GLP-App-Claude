import { useApp } from '../lib/store'
import { formatDisplayDate, toDateString } from '../lib/habitLogic'

export default function DateNav() {
  const { state, actions } = useApp()
  const { viewDate } = state
  const todayStr = toDateString(new Date())
  const isToday = viewDate === todayStr

  function changeDate(days) {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + days)
    actions.setViewDate(toDateString(d))
  }

  return (
    <>
      <div className="date-nav">
        <button className="date-btn" onClick={() => changeDate(-1)}>&#8249;</button>
        <div className="current-date-wrapper">
          <span className="current-date" style={!isToday ? { color: '#e53935' } : undefined}>{formatDisplayDate(viewDate)}</span>
          <input
            type="date"
            className="date-picker-overlay"
            value={viewDate}
            onChange={e => e.target.value && actions.setViewDate(e.target.value)}
          />
        </div>
        <button className="date-btn" onClick={() => changeDate(1)}>&#8250;</button>
      </div>
      {/* Promemoria "non sei su oggi": richiesto esplicitamente da Flavio —
          capita di scorrere avanti nei giorni per sbirciare le task future
          e poi dimenticarsi di tornare a oggi, restando "bloccati" su una
          vista non aggiornata senza accorgersene. Su ogni tab, dato che
          DateNav è renderizzato una sola volta in App.jsx sopra il contenuto
          di qualsiasi tab. */}
      {!isToday && (
        <button className="date-nav-warning" onClick={() => actions.setViewDate(todayStr)}>
          <span className="material-icons-round" style={{ fontSize: 15 }}>event_busy</span>
          Non sei su oggi — tocca per tornare a oggi
        </button>
      )}
    </>
  )
}
