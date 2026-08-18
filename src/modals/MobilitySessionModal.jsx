import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getMobilityRate } from '../lib/workoutStats'

export default function MobilitySessionModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  const [duration, setDuration] = useState(10)
  const [sessionDate, setSessionDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (modal === 'mobility') {
      setDuration(10)
      setSessionDate(toDateString(new Date()))
    }
  }, [modal])

  if (modal !== 'mobility') return null
  if (authUserId !== 'flavio') return null

  const rate = getMobilityRate()
  const pts = Math.round(duration * rate * 100) / 100

  function changeDuration(delta) {
    setDuration(prev => Math.max(1, Math.min(240, prev + delta)))
  }

  async function handleAdd() {
    setSaving(true)
    await actions.addMobilitySession(duration, sessionDate)
    setSaving(false)
    actions.closeModal()
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 36px',
        border: '1px solid var(--card-border)',
        animation: 'slideUp 0.22s ease',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          🧘 Sessione Mobility
        </div>

        {/* Duration counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
          <button onClick={() => changeDuration(-5)} style={btnStyle}>−5</button>
          <button onClick={() => changeDuration(-1)} style={{ ...btnStyle, width: 52, height: 52, fontSize: '1.4em' }}>−</button>

          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: '3.4em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>{duration}</div>
            <div style={{ fontSize: '0.65em', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>minuti</div>
          </div>

          <button onClick={() => changeDuration(1)} style={{ ...btnStyle, width: 52, height: 52, fontSize: '1.4em' }}>+</button>
          <button onClick={() => changeDuration(5)} style={btnStyle}>+5</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14, fontSize: '1.2em', fontWeight: 800, color: 'var(--success)' }}>
          = +{pts} pt
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
          <input
            type="date"
            value={sessionDate}
            max={toDateString(new Date())}
            onChange={e => setSessionDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
          />
        </div>

        <button
          className="btn-main"
          style={{ width: '100%', padding: '14px', fontSize: '1.05em' }}
          onClick={handleAdd}
          disabled={saving}
        >
          {saving ? '⏳ Salvataggio...' : 'Aggiungi 🧘'}
        </button>
      </div>
    </div>
  )
}

const btnStyle = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: '0.9em', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
