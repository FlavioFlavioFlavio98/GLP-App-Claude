import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getWillpowerRate } from '../lib/willpowerStats'

const POINT_OPTIONS = [1, 2, 3, 4, 5]

export default function WillpowerEntryModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  const [text, setText] = useState('')
  const [succeeded, setSucceeded] = useState(null) // null | true | false
  const [points, setPoints] = useState(null)
  const [entryDate, setEntryDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (modal === 'willpowerEntry') {
      setText('')
      setSucceeded(null)
      setPoints(null)
      setEntryDate(toDateString(new Date()))
    }
  }, [modal])

  if (modal !== 'willpowerEntry') return null
  if (authUserId !== 'flavio') return null

  function pickOutcome(val) {
    setSucceeded(val)
    setPoints(getWillpowerRate()) // preseleziona il default, resta modificabile
  }

  async function handleSave() {
    if (!text.trim()) { actions.showToast('Descrivi cosa dovevi fare', '⚠️'); return }
    if (succeeded === null) { actions.showToast('Seleziona l\'esito', '⚠️'); return }
    if (!points) { actions.showToast('Seleziona i punti', '⚠️'); return }
    setSaving(true)
    await actions.addWillpowerEntry(text, succeeded, entryDate, points)
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
          🔥 Willpower
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Cosa dovevi fare?
          </div>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Es. Filo interdentale"
            maxLength={100}
            autoFocus
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.95em', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => pickOutcome(true)}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 14,
              border: `1px solid var(--success, #4caf50)`,
              background: succeeded === true ? 'rgba(76,175,80,0.28)' : 'rgba(76,175,80,0.1)',
              boxShadow: succeeded === true ? '0 0 0 2px var(--success, #4caf50)' : 'none',
              color: 'var(--success, #4caf50)',
              fontWeight: 800, fontSize: '0.95em', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: '1.6em' }}>✅</span>
            L'ho fatto
          </button>
          <button
            onClick={() => pickOutcome(false)}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 14,
              border: `1px solid var(--danger, #e53935)`,
              background: succeeded === false ? 'rgba(229,57,53,0.24)' : 'rgba(229,57,53,0.08)',
              boxShadow: succeeded === false ? '0 0 0 2px var(--danger, #e53935)' : 'none',
              color: 'var(--danger, #e53935)',
              fontWeight: 800, fontSize: '0.95em', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: '1.6em' }}>❌</span>
            Non l'ho fatto
          </button>
        </div>

        {succeeded !== null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Quanti punti?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {POINT_OPTIONS.map(v => {
                const active = points === v
                const color = succeeded ? 'var(--success, #4caf50)' : 'var(--danger, #e53935)'
                const sign = succeeded ? '+' : '-'
                return (
                  <button
                    key={v}
                    onClick={() => setPoints(v)}
                    style={{
                      flex: 1, padding: '12px 4px', borderRadius: 10,
                      border: `1px solid ${color}`,
                      background: active ? color : 'transparent',
                      color: active ? '#111' : color,
                      fontWeight: 800, fontSize: '0.9em', cursor: 'pointer',
                    }}
                  >
                    {sign}{v}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
          <input
            type="date"
            value={entryDate}
            max={toDateString(new Date())}
            onChange={e => setEntryDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
          />
        </div>

        <button
          className="btn-main"
          style={{ width: '100%', padding: '14px', fontSize: '1.05em' }}
          onClick={handleSave}
          disabled={saving || !text.trim() || succeeded === null || !points}
        >
          {saving ? '⏳ Salvataggio...' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
