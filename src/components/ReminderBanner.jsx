import { useState } from 'react'
import { toDateString } from '../lib/habitLogic'

export default function ReminderBanner({ pendingCount }) {
  const today = toDateString(new Date())
  const storageKey = `glp_reminder_${today}`

  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(storageKey) === 'true'
  )

  if (dismissed || pendingCount === 0) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(storageKey, 'true')
  }

  return (
    <div className="reminder-banner">
      <span className="material-icons-round" style={{ fontSize: 16, flexShrink: 0 }}>schedule</span>
      <span className="reminder-text">
        Hai ancora <strong>{pendingCount}</strong> abitudine{pendingCount !== 1 ? 'i' : ''} da completare oggi
      </span>
      <button className="reminder-close" onClick={dismiss} aria-label="Chiudi">
        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  )
}
