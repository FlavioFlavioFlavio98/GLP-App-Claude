import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getLifeAreaRate } from '../lib/lifeAreaStats'

export default function LifeAreaLogModal() {
  const { state, actions } = useApp()
  const { modal, modalPayload, allUsersData, authUserId } = state

  const [areaId, setAreaId] = useState(null)
  const [duration, setDuration] = useState(30)
  const [note, setNote] = useState('')
  const [sessionDate, setSessionDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (modal === 'lifeAreaLog') {
      setAreaId(modalPayload?.areaId || null)
      setDuration(30)
      setNote('')
      setSessionDate(toDateString(new Date()))
    }
  }, [modal, modalPayload])

  if (modal !== 'lifeAreaLog') return null
  if (authUserId !== 'flavio') return null

  const areas = (allUsersData?.flavio?.lifeAreas || []).filter(a => a.active !== false)
  const rate = getLifeAreaRate()
  const pts = Math.round(duration * rate * 100) / 100

  function changeDuration(delta) {
    setDuration(prev => Math.max(1, Math.min(600, prev + delta)))
  }

  async function handleAdd() {
    if (!areaId) return
    setSaving(true)
    await actions.addLifeAreaSession(areaId, duration, note, sessionDate, 'manual')
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
          🌱 Sessione area della vita
        </div>

        {areas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: '0.9em', padding: '16px 0' }}>
            Nessuna area creata — vai su "Gestisci aree" per crearne una prima.
          </div>
        ) : (
          <>
            {/* Selettore area — chip, coerente con la selezione livello sforzo
                già usata altrove nell'app (es. QuickExerciseModal) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Area</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {areas.map(a => {
                  const active = areaId === a.id
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAreaId(a.id)}
                      style={{
                        padding: '8px 14px', borderRadius: 20,
                        border: active ? `1px solid ${a.color || 'var(--theme-color)'}` : '1px solid rgba(255,255,255,0.12)',
                        background: active ? `${a.color || 'var(--theme-color)'}22` : 'rgba(255,255,255,0.05)',
                        color: active ? (a.color || 'var(--theme-color)') : 'var(--text)',
                        fontSize: '0.9em', fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {a.emoji} {a.name}
                    </button>
                  )
                })}
              </div>
            </div>

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
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nota (opzionale)</div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Es. Lettura Come trattare gli altri e farseli amici"
                maxLength={200}
                rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85em', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }}
              />
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
              style={{ width: '100%', padding: '14px', fontSize: '1.05em', opacity: areaId ? 1 : 0.5 }}
              onClick={handleAdd}
              disabled={saving || !areaId}
            >
              {saving ? '⏳ Salvataggio...' : (areaId ? 'Aggiungi 🌱' : 'Scegli un\'area')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const btnStyle = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text)', fontSize: '0.9em', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
