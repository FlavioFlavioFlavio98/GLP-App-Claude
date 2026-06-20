import { useState } from 'react'
import { useApp } from '../lib/store'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toDateString } from '../lib/habitLogic'

export default function HabitDiaryPage({ habit, onClose, viewDate, authUserId }) {
  const { actions, state } = useApp()
  const userData = state.allUsersData?.[authUserId]
  const habitId = habit.id || habit.name?.replace(/[^a-zA-Z0-9]/g, '')

  // Text note state
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)

  // Voice notes (now text notes) — stored on habit.voiceNotes
  const textNotes = [...(habit.voiceNotes || [])].sort((a, b) => b.date.localeCompare(a.date))

  // Habit diary entries from coach
  const habitDiary = userData?.habitDiaries?.[habitId]
  const diaryEntries = habitDiary ? [...(habitDiary.entries || [])].sort((a, b) => b.date.localeCompare(a.date)) : []
  const latestCoachEntry = diaryEntries[0] || null
  const [showAllDiary, setShowAllDiary] = useState(false)

  async function saveNote() {
    const text = noteText.trim()
    if (!text) return
    setSaving(true)
    try {
      const note = {
        id: `note_${Date.now()}`,
        date: viewDate || toDateString(new Date()),
        text,
        costEUR: 0,
        createdAt: new Date().toISOString(),
      }
      const userRef = doc(db, 'users', authUserId)
      const habits = userData?.habits || []
      const updatedHabits = habits.map(h => {
        const hId = h.id || h.name?.replace(/[^a-zA-Z0-9]/g, '')
        if (hId !== habitId) return h
        return { ...h, voiceNotes: [...(h.voiceNotes || []), note] }
      })
      await updateDoc(userRef, { habits: updatedHabits })
      setNoteText('')
      actions.showToast('Nota salvata ✓', '📖')
    } catch (e) {
      actions.showToast('Errore: ' + e.message, '❌')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(noteId) {
    await actions.deleteVoiceNote(habitId, 'habit', noteId)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg)',
      zIndex: 9999,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 16px 14px',
        display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text)',
          fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1,
        }}>←</button>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{habit.name}</div>
          <div style={{ fontSize: '0.8em', color: 'var(--text-sec)' }}>📖 Diario</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 16px 60px' }}>

        {/* ── Coach Analysis ── */}
        {latestCoachEntry && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
              🤖 Analisi Coach
            </div>
            <div style={{
              background: 'rgba(108,99,255,0.08)',
              border: '1px solid rgba(108,99,255,0.2)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <div style={{ fontSize: '0.7em', color: 'var(--theme-color)', marginBottom: 10, fontWeight: 700 }}>
                {latestCoachEntry.date}
              </div>
              {latestCoachEntry.narrative && (
                <div style={{ fontStyle: 'italic', color: 'var(--text-sec)', fontSize: '0.9em', lineHeight: 1.6, marginBottom: 12 }}>
                  "{latestCoachEntry.narrative}"
                </div>
              )}
              {latestCoachEntry.keyPoints?.why && (
                <DiaryRow icon="💡" label="Perché la faccio" value={latestCoachEntry.keyPoints.why} />
              )}
              {latestCoachEntry.keyPoints?.whenFails && (
                <DiaryRow icon="⚠️" label="Quando fallisco" value={latestCoachEntry.keyPoints.whenFails} />
              )}
              {latestCoachEntry.keyPoints?.coachTips?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 4 }}>📌 Consigli del Coach</div>
                  {latestCoachEntry.keyPoints.coachTips.map((tip, i) => (
                    <div key={i} style={{ fontSize: '0.86em', color: 'var(--text)', paddingLeft: 8, lineHeight: 1.5 }}>• {tip}</div>
                  ))}
                </div>
              )}
              {latestCoachEntry.keyPoints?.patterns && (
                <DiaryRow icon="📊" label="Pattern" value={latestCoachEntry.keyPoints.patterns} />
              )}
            </div>

            {/* Past coach entries */}
            {diaryEntries.length > 1 && (
              <button
                onClick={() => setShowAllDiary(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.78em', marginTop: 8, padding: 0 }}
              >
                {showAllDiary ? '▲ Mostra meno' : `▼ Storico aggiornamenti Coach (${diaryEntries.length - 1} precedenti)`}
              </button>
            )}
            {showAllDiary && diaryEntries.slice(1).map(entry => (
              <div key={entry.id} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '12px 14px', marginTop: 8,
              }}>
                <div style={{ fontSize: '0.7em', color: 'var(--theme-color)', marginBottom: 6, fontWeight: 700 }}>{entry.date}</div>
                <div style={{ fontSize: '0.85em', color: 'var(--text-sec)', lineHeight: 1.5 }}>{entry.narrative}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── New text note ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
            ✏️ Scrivi una nota
          </div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            inputMode="text"
            placeholder="Scrivi una nota su questa abitudine... (puoi usare la tastiera vocale Gboard)"
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--card)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '14px',
              color: 'var(--text)', fontSize: '1em',
              lineHeight: 1.6, resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
              minHeight: 120,
            }}
          />
          <button
            onClick={saveNote}
            disabled={!noteText.trim() || saving}
            style={{
              width: '100%', padding: '13px',
              background: noteText.trim() ? 'var(--theme-color)' : 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: 12,
              color: noteText.trim() ? '#fff' : '#555',
              fontWeight: 700, fontSize: '0.95em',
              cursor: noteText.trim() ? 'pointer' : 'default',
              marginTop: 10, transition: 'background 0.2s',
            }}
          >
            {saving ? 'Salvataggio...' : '💾 Salva nota'}
          </button>
        </div>

        {/* ── Text notes history ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
            Note precedenti {textNotes.length > 0 && `(${textNotes.length})`}
          </div>
          {textNotes.length === 0 && (
            <div style={{ color: 'var(--text-sec)', textAlign: 'center', padding: '24px 0', fontSize: '0.9em' }}>
              Nessuna nota ancora
            </div>
          )}
          {textNotes.map(note => (
            <div key={note.id} style={{
              padding: '12px 14px', background: 'var(--card)',
              borderRadius: 10, marginBottom: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', marginBottom: 6 }}>{note.date}</div>
              <div style={{ fontSize: '0.95em', lineHeight: 1.6 }}>{note.text}</div>
              <button
                onClick={() => deleteNote(note.id)}
                style={{ background: 'none', border: 'none', color: 'var(--danger, #e53935)', cursor: 'pointer', fontSize: '0.78em', marginTop: 8, padding: 0 }}
              >
                🗑️ Elimina
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DiaryRow({ icon, label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 3 }}>{icon} {label}</div>
      <div style={{ fontSize: '0.86em', color: 'var(--text)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}
