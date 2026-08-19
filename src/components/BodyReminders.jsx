import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { toDateString } from '../lib/habitLogic'

const PHOTO_REMINDER_DAYS = 7
const WEIGHT_REMINDER_DAYS = 3

function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

function ReminderCard({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.3)', borderRadius: 12,
      marginBottom: 8,
    }}>
      <span style={{ fontSize: '1.3em', flexShrink: 0 }}>{icon}</span>
      <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#EF9F27' }}>{text}</div>
    </div>
  )
}

// Banner sempre visibili (non dismissibili) finché non si registra il dato
// mancante — a differenza di ReminderBanner.jsx che è per task giornaliere.
export default function BodyReminders({ authUserId, weightLog }) {
  const [lastPhotoDate, setLastPhotoDate] = useState(undefined) // undefined = ancora caricando

  useEffect(() => {
    if (authUserId !== 'flavio') return
    const q = query(collection(db, 'users', 'flavio', 'bodyPhotos'), orderBy('createdAt', 'desc'), limit(1))
    return onSnapshot(q, snap => setLastPhotoDate(snap.empty ? null : snap.docs[0].data().dateStr))
  }, [authUserId])

  const weightDates = Object.keys(weightLog || {}).sort()
  const lastWeightDate = weightDates.length ? weightDates.at(-1) : null

  const photoDaysSince = lastPhotoDate ? daysSince(lastPhotoDate) : null
  const weightDaysSince = lastWeightDate ? daysSince(lastWeightDate) : null

  const showPhotoReminder = lastPhotoDate !== undefined && (lastPhotoDate === null || photoDaysSince >= PHOTO_REMINDER_DAYS)
  const showWeightReminder = lastWeightDate === null || weightDaysSince >= WEIGHT_REMINDER_DAYS

  if (!showPhotoReminder && !showWeightReminder) return null

  return (
    <div style={{ marginBottom: 4 }}>
      {showPhotoReminder && (
        <ReminderCard
          icon="📸"
          text={lastPhotoDate === null
            ? 'Non hai ancora caricato un check fisico — carica le prime foto per iniziare a tracciare i risultati'
            : `Sono ${photoDaysSince} giorni che non carichi una foto — carica il check fisico settimanale`}
        />
      )}
      {showWeightReminder && (
        <ReminderCard
          icon="⚖️"
          text={lastWeightDate === null
            ? 'Non hai ancora registrato il peso'
            : `Sono ${weightDaysSince} giorni che non registri il peso`}
        />
      )}
    </div>
  )
}
