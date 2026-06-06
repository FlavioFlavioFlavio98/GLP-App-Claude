import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { formatDisplayDate, toDateString } from '../lib/habitLogic'

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function formatClock(date) {
  const giorno = GIORNI[date.getDay()]
  const giornNum = date.getDate()
  const mese = MESI[date.getMonth()]
  const anno = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${giorno} ${giornNum} ${mese} ${anno} • ${hh}:${mm}`
}

export default function DateNav() {
  const { state, actions } = useApp()
  const { viewDate } = state
  const [now, setNow] = useState(new Date())

  const todayStr = toDateString(new Date())
  const isToday = viewDate === todayStr

  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [isToday])

  function changeDate(days) {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + days)
    actions.setViewDate(toDateString(d))
  }

  return (
    <div className="date-nav" style={{ flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
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
      {isToday && (
        <div style={{
          fontSize: '0.68em',
          color: '#555',
          letterSpacing: 0.2,
          textAlign: 'center',
          paddingBottom: 2,
        }}>
          {formatClock(now)}
        </div>
      )}
    </div>
  )
}
