import { useState, useMemo } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

const CHECK_IN_QUESTIONS = {
  morning: [
    "Qual è la tua intenzione principale per oggi?",
    "Come ti senti fisicamente stamattina?",
    "Cosa vuoi assolutamente fare oggi?",
    "Con che energia ti svegli oggi?"
  ],
  midday: [
    "Come sta andando la giornata finora?",
    "Hai già completato qualcosa di importante?",
    "Cosa ti manca ancora da fare oggi?",
    "Il tuo livello di energia è alto o basso?"
  ],
  evening: [
    "Qual è stata la tua vittoria più grande oggi?",
    "Cosa avresti potuto fare meglio?",
    "Sei soddisfatto della giornata?",
    "Cosa prepari per domani?"
  ]
}

const SLOT_META = {
  morning: { emoji: '🌅', label: 'Check-in mattino',     hours: [6, 12] },
  midday:  { emoji: '☀️', label: 'Check-in mezzogiorno', hours: [12, 17] },
  evening: { emoji: '🌙', label: 'Check-in sera',         hours: [17, 24] },
}

function getCurrentSlot() {
  const h = new Date().getHours()
  if (h >= 6  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'midday'
  if (h >= 17 && h < 24) return 'evening'
  return null
}

export default function CheckInBanner() {
  const { state, actions } = useApp()
  const { authUserId, globalData } = state
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const slot = getCurrentSlot()

  // Pick a stable random question per slot per day
  const question = useMemo(() => {
    if (!slot) return ''
    const questions = CHECK_IN_QUESTIONS[slot]
    const today = toDateString(new Date())
    // Use date string + slot as seed for a stable choice
    const seed = (today + slot).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return questions[seed % questions.length]
  }, [slot])

  if (authUserId !== 'flavio') return null
  if (!slot || !globalData) return null

  const today = toDateString(new Date())
  const checkIns = globalData.dailyLogs?.[today]?.checkIns || {}
  if (checkIns[slot]?.done) return null

  const meta = SLOT_META[slot]

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = answer.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await actions.completeCheckIn(slot, trimmed)
      setAnswer('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(255,202,40,0.06)',
      border: '1px solid rgba(255,202,40,0.2)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '1.1em' }}>{meta.emoji}</span>
        <span style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--theme-color)' }}>{meta.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72em', color: '#4caf50', fontWeight: 700 }}>+1pt</span>
      </div>
      <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: 8, fontStyle: 'italic' }}>
        "{question}"
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="La tua risposta..."
          disabled={submitting}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '7px 10px',
            color: 'var(--text)',
            fontSize: '0.82em',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={submitting || !answer.trim()}
          style={{
            background: 'var(--theme-color)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '7px 14px',
            fontWeight: 700,
            fontSize: '0.8em',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting || !answer.trim() ? 0.5 : 1,
          }}
        >
          {submitting ? '...' : 'Conferma'}
        </button>
      </form>
    </div>
  )
}
