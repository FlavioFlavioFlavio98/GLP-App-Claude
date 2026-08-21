import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getWillpowerRate } from '../lib/willpowerStats'

export default function WillpowerEntryModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  const [text, setText] = useState('')
  const [entryDate, setEntryDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (modal === 'willpowerEntry') {
      setText('')
      setEntryDate(toDateString(new Date()))
    }
  }, [modal])

  if (modal !== 'willpowerEntry') return null
  if (authUserId !== 'flavio') return null

  const rate = getWillpowerRate()

  async function handleLog(succeeded) {
    if (!text.trim()) { actions.showToast('Descrivi cosa dovevi fare', '⚠️'); return }
    setSaving(true)
    await actions.addWillpowerEntry(text, succeeded, entryDate)
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

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => handleLog(true)}
            disabled={saving || !text.trim()}
            style={{
              flex: 1, padding: '18px 12px', borderRadius: 14, border: '1px solid var(--success, #4caf50)',
              background: 'rgba(76,175,80,0.12)', color: 'var(--success, #4caf50)',
              fontWeight: 800, fontSize: '0.95em', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: '1.6em' }}>✅</span>
            L'ho fatto
            <span style={{ fontSize: '0.75em', fontWeight: 700 }}>+{rate}pt</span>
          </button>
          <button
            onClick={() => handleLog(false)}
            disabled={saving || !text.trim()}
            style={{
              flex: 1, padding: '18px 12px', borderRadius: 14, border: '1px solid var(--danger, #e53935)',
              background: 'rgba(229,57,53,0.1)', color: 'var(--danger, #e53935)',
              fontWeight: 800, fontSize: '0.95em', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: '1.6em' }}>❌</span>
            Non l'ho fatto
            <span style={{ fontSize: '0.75em', fontWeight: 700 }}>-{rate}pt</span>
          </button>
        </div>

        <div>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
          <input
            type="date"
            value={entryDate}
            max={toDateString(new Date())}
            onChange={e => setEntryDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
          />
        </div>
      </div>
    </div>
  )
}
