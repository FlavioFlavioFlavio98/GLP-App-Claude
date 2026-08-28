import { useState } from 'react'
import { toDateString } from '../lib/habitLogic'

const THRESHOLD_DAYS = 3

// Promemoria "in alto nell'app" (sotto l'header, su ogni tab) se l'ultimo
// backup manuale scaricato ha più di 3 giorni — o non ne hai mai scaricato
// uno. Dismissibile per il giorno corrente (come ReminderBanner per le
// abitudini): se il backup resta vecchio, ricompare il giorno dopo finché
// non lo rinnovi.
export default function BackupReminderBanner({ lastDataExportAt, actions }) {
  const today = toDateString(new Date())
  const storageKey = `glp_backup_reminder_${today}`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === 'true')

  const days = lastDataExportAt
    ? Math.floor((Date.now() - new Date(lastDataExportAt).getTime()) / 86400000)
    : null

  const isStale = days === null || days >= THRESHOLD_DAYS
  if (dismissed || !isStale) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(storageKey, 'true')
  }

  return (
    <div className="reminder-banner">
      <span className="material-icons-round" style={{ fontSize: 16, flexShrink: 0 }}>cloud_download</span>
      <span className="reminder-text">
        {days === null
          ? 'Non hai ancora scaricato un backup dei tuoi dati'
          : <>L'ultimo backup scaricato è di <strong>{days} giorni fa</strong></>}
        {' — '}
        <a
          href="#"
          onClick={e => { e.preventDefault(); actions.openModal('settings') }}
          style={{ color: 'var(--theme-color)', fontWeight: 700, textDecoration: 'none' }}
        >
          scaricalo ora
        </a>
      </span>
      <button className="reminder-close" onClick={dismiss} aria-label="Chiudi">
        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  )
}
