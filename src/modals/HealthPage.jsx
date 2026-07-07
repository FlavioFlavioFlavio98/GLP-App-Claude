import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

function getLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ProgressBar({ value, max, color = 'var(--theme-color)' }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ background: '#333', borderRadius: 4, height: 6, marginTop: 10, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function HealthPage() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  const [healthData, setHealthData] = useState(null)
  const today = getLocalDateString()

  useEffect(() => {
    if (modal !== 'health') return
    const unsub = onSnapshot(doc(db, 'users', 'flavio'), (snap) => {
      const data = snap.data()?.healthData?.[today] || null
      console.log('HealthPage data for', today, ':', data)
      setHealthData(data)
    })
    return unsub
  }, [modal, today])

  if (modal !== 'health') return null
  if (authUserId !== 'flavio') return null

  const steps = healthData?.steps ?? null
  const sleep = healthData?.sleepHours ?? null
  const syncedAt = healthData?.syncedAt
  const syncTimeStr = syncedAt
    ? new Date(syncedAt.seconds ? syncedAt.seconds * 1000 : syncedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : null

  const stepsPoints = steps !== null ? (steps >= 5000 ? Math.min(steps * 0.002, 20).toFixed(1) : '0') : null
  const sleepPositive = sleep !== null && sleep >= 6
  const sleepPoints = sleep !== null ? (sleepPositive ? Math.min(sleep, 10).toFixed(1) : '-3') : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 9999, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
        <button
          onClick={() => actions.openModal(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '1.3em', lineHeight: 1, padding: '4px 8px' }}
        >←</button>
        <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>❤️ Salute</div>
        <div style={{ marginLeft: 'auto', fontSize: '0.78em', color: 'var(--text-sec)' }}>
          {today}
          {syncTimeStr && ` · Sync: ${syncTimeStr}`}
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Passi */}
        <div style={{ background: 'var(--card, rgba(255,255,255,0.04))', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>🦶 Passi</div>
          {steps !== null ? (
            <>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: 'var(--theme-color)' }}>
                {steps.toLocaleString('it-IT')}
              </div>
              <div style={{ color: 'var(--success, #4CAF50)', fontSize: '0.85em', marginTop: 4 }}>
                +{stepsPoints}pt guadagnati
              </div>
              <ProgressBar value={steps} max={10000} color="var(--theme-color)" />
              <div style={{ color: 'var(--text-sec)', fontSize: '0.75em', marginTop: 4 }}>
                {Math.round((steps / 10000) * 100)}% verso 10.000 passi
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-sec)', fontSize: '0.88em' }}>Nessun dato — apri l'app Android per sincronizzare</div>
          )}
        </div>

        {/* Sonno */}
        <div style={{ background: 'var(--card, rgba(255,255,255,0.04))', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>😴 Sonno</div>
          {sleep !== null ? (
            <>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: sleepPositive ? 'var(--theme-color)' : 'var(--danger, #EF5350)' }}>
                {parseFloat(sleep).toFixed(1)}h
              </div>
              <div style={{ color: sleepPositive ? 'var(--success, #4CAF50)' : 'var(--danger, #EF5350)', fontSize: '0.85em', marginTop: 4 }}>
                {sleepPositive ? '+' : ''}{sleepPoints}pt {sleepPositive ? 'guadagnati' : '(sotto 6h = -3pt)'}
              </div>
              <ProgressBar value={sleep} max={8} color={sleepPositive ? '#7C4DFF' : 'var(--danger, #EF5350)'} />
              <div style={{ color: 'var(--text-sec)', fontSize: '0.75em', marginTop: 4 }}>
                {Math.round((sleep / 8) * 100)}% verso 8 ore ideali
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-sec)', fontSize: '0.88em' }}>Nessun dato — apri l'app Android la mattina per sincronizzare</div>
          )}
        </div>

        {/* Storico */}
        <div style={{ background: 'var(--card, rgba(255,255,255,0.04))', borderRadius: 14, padding: '16px' }}>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📅 Ultimi 7 giorni</div>
          <div style={{ color: 'var(--text-sec)', fontSize: '0.85em' }}>Storico passi e sonno in arrivo...</div>
        </div>
      </div>
    </div>
  )
}
