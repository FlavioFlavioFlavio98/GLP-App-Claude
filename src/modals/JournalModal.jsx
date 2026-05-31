import { useEffect, useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getQuestionForDate, CAT_LABELS } from '../lib/journalQuestions'

export default function JournalModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'journal') return null

  const today = toDateString(new Date())
  const q = getQuestionForDate(today)
  const existing = globalData?.journalEntries?.[today]

  const [answer, setAnswer] = useState(existing?.answer || '')
  const [saved, setSaved] = useState(Boolean(existing?.answer))
  const [readMode, setReadMode] = useState(Boolean(existing?.answer))

  useEffect(() => {
    const ex = globalData?.journalEntries?.[today]
    setAnswer(ex?.answer || '')
    setSaved(Boolean(ex?.answer))
    setReadMode(Boolean(ex?.answer))
  }, [modal])

  async function handleSave() {
    if (!answer.trim()) return
    await actions.saveJournalEntry(today, { questionId: q.id, question: q.text, answer: answer.trim() })
    setSaved(true)
    setReadMode(true)
    actions.showToast('Diario salvato!', '📔')
    setTimeout(() => actions.closeModal(), 600)
  }

  async function handleSkip() {
    await actions.saveJournalEntry(today, { questionId: q.id, question: q.text, answer: '' })
    actions.closeModal()
  }

  const catLabel = CAT_LABELS[q.cat] || q.cat
  const remaining = 500 - answer.length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        {/* Category badge */}
        <div style={{ fontSize: '0.68em', color: '#666', marginBottom: 12, letterSpacing: 0.5 }}>
          {catLabel}
        </div>

        {/* Question */}
        <h3 style={{ fontSize: '1.15em', lineHeight: 1.4, marginBottom: 20, color: 'var(--text)' }}>
          {q.text}
        </h3>

        {readMode ? (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 16,
              fontSize: '0.9em', color: 'var(--text-sec)', lineHeight: 1.6, fontStyle: 'italic',
            }}>
              {answer || <span style={{ color: '#555' }}>(Saltata)</span>}
            </div>
            <button className="btn-backup" onClick={() => setReadMode(false)}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
              Modifica risposta
            </button>
            <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
          </>
        ) : (
          <>
            <textarea
              rows={5}
              placeholder="Scrivi qui la tua risposta..."
              value={answer}
              onChange={e => setAnswer(e.target.value.slice(0, 500))}
              style={{ resize: 'none', marginBottom: 4 }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68em', color: remaining < 50 ? 'var(--danger)' : '#444', marginBottom: 16 }}>
              <span />
              <span>{remaining} caratteri rimanenti</span>
            </div>

            <button className="btn-main" onClick={handleSave} disabled={!answer.trim()}>
              Salva risposta
            </button>
            {!saved && (
              <button className="btn-sec" style={{ color: '#555', fontSize: '0.82em' }} onClick={handleSkip}>
                Salta per oggi
              </button>
            )}
            {saved && (
              <button className="btn-sec" onClick={() => setReadMode(true)}>Annulla</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
