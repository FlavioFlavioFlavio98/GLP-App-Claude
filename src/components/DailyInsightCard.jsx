import { useState, useEffect, useRef } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { db } from '../lib/firebase'
import { toDateString } from '../lib/habitLogic'
import { buildCoachContext } from '../lib/coachContext'
import { buildInsightSystemPrompt } from '../lib/coachPrompt'

// Inizializzato una volta fuori dal componente
const _functions = getFunctions(getApp(), 'europe-west1')
const insightFn = httpsCallable(_functions, 'generateDailyInsight', { timeout: 60000 })

export default function DailyInsightCard({ userData, dailyLogs, tags, onOpenCoach }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | hidden
  const [content, setContent] = useState(null)
  const generatingRef = useRef(false)

  const today = toDateString(new Date())
  const storedInsight = userData?.dailyInsight

  useEffect(() => {
    if (!userData) return

    // Già abbiamo l'insight di oggi
    if (storedInsight?.date === today && storedInsight?.content) {
      setContent(storedInsight.content)
      setStatus('ready')
      return
    }

    // Genera una sola volta per sessione
    if (generatingRef.current) return
    generatingRef.current = true
    setStatus('loading')

    ;(async () => {
      try {
        const context = buildCoachContext(userData, dailyLogs || {}, tags || [])
        const systemPrompt = buildInsightSystemPrompt(context)
        const result = await insightFn({ coachContext: context, systemPrompt })
        const text = result?.data?.content
        if (!text) { setStatus('hidden'); return }
        setContent(text)
        setStatus('ready')
        // Salva su Firestore (fire-and-forget)
        setDoc(
          doc(db, 'users', 'flavio'),
          { dailyInsight: { date: today, content: text, generatedAt: Date.now() } },
          { merge: true }
        ).catch(() => {})
      } catch (e) {
        console.warn('[DailyInsightCard] failed (silent):', e?.code || e?.message)
        setStatus('hidden')
      }
    })()
  }, [userData?.score, today]) // ri-esegui solo se cambia l'utente o il giorno

  if (status === 'hidden' || status === 'idle') return null

  if (status === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💡</span>
          <span style={{ fontSize: '0.78em', color: '#555' }}>Generazione insight del giorno...</span>
          <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: '#555',
                animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        💡 Insight del giorno
      </div>
      <div style={{ fontSize: '0.84em', lineHeight: 1.55, color: 'var(--text-sec)', marginBottom: 8 }}>
        "{content}"
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onOpenCoach(content)}
          style={{ background: 'none', border: 'none', color: 'var(--theme-color)', fontSize: '0.78em', fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          Chiedi al Coach →
        </button>
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: '11px 14px',
  marginBottom: 12,
}
