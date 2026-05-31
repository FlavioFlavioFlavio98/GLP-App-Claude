import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

export const MOODS = [
  { value: 1, emoji: '😞', label: 'Pessima',   color: '#E24B4A' },
  { value: 2, emoji: '😕', label: 'Difficile', color: '#EF9F27' },
  { value: 3, emoji: '😐', label: 'Norma',     color: '#888888' },
  { value: 4, emoji: '😊', label: 'Buona',     color: '#639922' },
  { value: 5, emoji: '🤩', label: 'Fantastica', color: '#1D9E75' },
]

export default function MoodModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'mood') return null

  const today = toDateString(new Date())
  const existing = globalData?.dailyLogs?.[today]?.mood?.[currentUser]

  const [selected, setSelected] = useState(existing?.value ?? null)
  const [note, setNote] = useState(existing?.note ?? '')

  useEffect(() => {
    const ex = globalData?.dailyLogs?.[today]?.mood?.[currentUser]
    setSelected(ex?.value ?? null)
    setNote(ex?.note ?? '')
  }, [modal])

  const selectedMood = MOODS.find(m => m.value === selected)

  async function handleSave() {
    if (!selected) return
    await actions.saveMood(today, { value: selected, emoji: selectedMood.emoji, note: note.slice(0, 100) })
    actions.closeModal()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>🌤 Come è andata oggi?</h3>

        {/* 5 mood cards */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {MOODS.map(m => {
            const active = selected === m.value
            return (
              <button
                key={m.value}
                onClick={() => setSelected(m.value)}
                style={{
                  flex: 1, padding: '10px 2px', borderRadius: 14, cursor: 'pointer',
                  background: active ? `${m.color}33` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${active ? m.color : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all 0.18s', transform: active ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: '1.6em' }}>{m.emoji}</span>
                <span style={{ fontSize: '0.52em', color: active ? m.color : '#555', fontWeight: 700, letterSpacing: 0.3 }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Note */}
        <input
          type="text"
          placeholder="Nota sul tuo giorno... (opzionale)"
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 100))}
          style={{ marginBottom: 4 }}
        />
        <div style={{ fontSize: '0.68em', color: '#555', textAlign: 'right', marginBottom: 12 }}>
          {note.length}/100
        </div>

        <button className="btn-main" onClick={handleSave} disabled={!selected}>Salva</button>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
