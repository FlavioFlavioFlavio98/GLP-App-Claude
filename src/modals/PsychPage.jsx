import { useState, useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { toDateString } from '../lib/habitLogic'
import { buildPsychSystemPrompt } from '../lib/psychPrompt'
import { buildGlpContext } from '../lib/psychContext'
import PsychProfilePage from './PsychProfilePage'

const MODELS = [
  { id: 'gemini-2.5-flash-lite', label: '⚡ Gemini 2.5 Flash-Lite', desc: 'economico e veloce' },
  { id: 'gemini-2.5-flash',      label: '🔵 Gemini 2.5 Flash',      desc: 'bilanciato' },
  { id: 'gemini-2.5-pro',        label: '🟣 Gemini 2.5 Pro',         desc: 'il più intelligente' },
  { id: 'gemini-3.5-flash',      label: '🌟 Gemini 3.5 Flash',       desc: 'frontier' },
]

const CHAT_KEY = 'glp_psych_chat_flavio'

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h4 style="margin:10px 0 4px;font-size:0.9em;color:var(--theme-color)">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 style="margin:12px 0 6px;font-size:1em">$1</h3>')
    .replace(/^- (.*$)/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0;padding-left:18px">${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

export default function PsychPage({ onClose }) {
  const { state, actions } = useApp()
  const { authUserId, allUsersData } = state
  const userData = allUsersData?.flavio || {}
  const dailyLogs = userData?.dailyLogs || {}

  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('gemini-2.5-flash-lite')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [sessionStats, setSessionStats] = useState({ tokens: 0, costEUR: 0 })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [lastProfileUpdate, setLastProfileUpdate] = useState(() => {
    const p = userData?.psychProfile
    return p?.lastUpdated ? new Date(p.lastUpdated) : null
  })
  const messagesEndRef = useRef(null)
  const isUpdatingRef = useRef(false)

  const fns = getFunctions(getApp(), 'europe-west1')
  const geminiChatFn = httpsCallable(fns, 'geminiChat', { timeout: 60000 })
  const updatePsychProfileFn = httpsCallable(fns, 'updatePsychProfile', { timeout: 60000 })

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(CHAT_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Update profile on page hide
  useEffect(() => {
    const handler = async () => {
      if (document.hidden && messages.length > 2 && !isUpdatingRef.current) {
        await triggerProfileUpdate()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [messages])

  async function triggerProfileUpdate() {
    if (isUpdatingRef.current || messages.length < 3) return
    isUpdatingRef.current = true
    setIsUpdatingProfile(true)
    try {
      const glpContext = buildGlpContext(userData, dailyLogs)
      const result = await updatePsychProfileFn({
        sessionMessages: messages.map(m => ({ role: m.role, content: m.content })),
        existingProfile: userData?.psychProfile || {},
        glpContext,
      })
      await updateDoc(doc(db, 'users', 'flavio'), { psychProfile: result.data.profile })
      setLastProfileUpdate(new Date())
      actions.showToast('🧠 Profilo psicologico aggiornato', '✅')
    } catch (e) {
      console.error('[PsychPage] profile update failed:', e)
    } finally {
      isUpdatingRef.current = false
      setIsUpdatingProfile(false)
    }
  }

  async function handleSend(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg = { role: 'user', content, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const psychProfile = userData?.psychProfile || null
      const glpContext = buildGlpContext(userData, dailyLogs)
      const systemPrompt = buildPsychSystemPrompt(psychProfile, glpContext)
      const result = await geminiChatFn({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
        model,
      })
      const { content: reply, usage } = result.data
      const assistantMsg = { role: 'assistant', content: reply, usage, timestamp: new Date().toISOString() }
      setMessages(prev => [...prev, assistantMsg])
      setSessionStats(prev => ({
        tokens: prev.tokens + (usage?.totalTokens || 0),
        costEUR: parseFloat((prev.costEUR + (usage?.costEUR || 0)).toFixed(6)),
      }))
    } catch (e) {
      actions.showToast('Errore: ' + (e.message || 'Riprova'), '❌')
    } finally {
      setLoading(false)
    }
  }

  async function handleNewSession() {
    if (!window.confirm('Iniziare una nuova sessione? La chat sarà resettata.')) return
    // Save session summary + update profile
    if (messages.length >= 2) {
      try {
        const sessionEntry = {
          id: `sess_${Date.now()}`,
          date: toDateString(new Date()),
          model,
          messageCount: messages.length,
          totalTokens: sessionStats.tokens,
          totalCostEUR: sessionStats.costEUR,
        }
        // Read existing sessions
        const snap = await getDoc(doc(db, 'users', 'flavio'))
        const existingSessions = snap.data()?.psychSessions || []
        const existingStats = snap.data()?.psychStats || { totalTokensLifetime: 0, totalCostEURLifetime: 0, totalSessions: 0, totalMessages: 0 }
        const newStats = {
          totalTokensLifetime: (existingStats.totalTokensLifetime || 0) + sessionStats.tokens,
          totalCostEURLifetime: parseFloat(((existingStats.totalCostEURLifetime || 0) + sessionStats.costEUR).toFixed(6)),
          totalSessions: (existingStats.totalSessions || 0) + 1,
          totalMessages: (existingStats.totalMessages || 0) + messages.length,
        }
        await updateDoc(doc(db, 'users', 'flavio'), {
          psychSessions: [...existingSessions.slice(-49), sessionEntry],
          psychStats: newStats,
        })
        await triggerProfileUpdate()
      } catch (e) { console.warn('[PsychPage] session save failed:', e) }
    }
    setMessages([])
    setSessionStats({ tokens: 0, costEUR: 0 })
    localStorage.removeItem(CHAT_KEY)
  }

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[0]

  const profileUpdateLabel = lastProfileUpdate
    ? (() => {
        const now = new Date()
        const diff = now - lastProfileUpdate
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'pochi secondi fa'
        if (mins < 60) return `${mins} min fa`
        const today = toDateString(now)
        const updateDay = toDateString(lastProfileUpdate)
        if (today === updateDay) return `oggi alle ${lastProfileUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
        return lastProfileUpdate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      })()
    : null

  if (showProfile) {
    return (
      <PsychProfilePage
        psychProfile={userData?.psychProfile}
        psychSessions={userData?.psychSessions || []}
        psychStats={userData?.psychStats || {}}
        onClose={() => setShowProfile(false)}
        authUserId={authUserId}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05em' }}>🧠 Psicologo AI</div>
            <div style={{ fontSize: '0.72em', color: 'var(--text-sec)' }}>Spazio personale di Flavio</div>
          </div>
        </div>
        <button onClick={() => setShowProfile(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</button>
      </div>

      {/* Model picker */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={() => setShowModelPicker(v => !v)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82em', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>{selectedModel.label}</span>
          <span style={{ color: '#666', fontSize: '0.85em' }}>· {selectedModel.desc}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>▼</span>
        </button>
        {showModelPicker && (
          <div style={{ marginTop: 6, background: 'var(--card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
            {MODELS.map(m => (
              <button key={m.id} onClick={() => { setModel(m.id); setShowModelPicker(false) }}
                style={{ width: '100%', padding: '10px 14px', background: model === m.id ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85em', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                <span>{m.label}</span>
                <span style={{ color: '#666', fontSize: '0.85em' }}>{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, fontSize: '0.7em', color: '#555', display: 'flex', gap: 10 }}>
        <span>Sessione: {sessionStats.tokens.toLocaleString()} tok · €{sessionStats.costEUR.toFixed(4)}</span>
        <span>·</span>
        <span>Lifetime: {(userData?.psychStats?.totalTokensLifetime || 0).toLocaleString()} tok · €{(userData?.psychStats?.totalCostEURLifetime || 0).toFixed(4)}</span>
      </div>

      {/* Profile update indicator */}
      <div style={{ padding: '5px 16px', fontSize: '0.7em', color: '#555', flexShrink: 0 }}>
        🧠 {profileUpdateLabel ? `Profilo aggiornato: ${profileUpdateLabel}` : 'Profilo non ancora generato'}
        {isUpdatingProfile && ' — aggiornando...'}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: '0.9em' }}>
            <div style={{ fontSize: '2.5em', marginBottom: 12 }}>🧠</div>
            <div>Di cosa vuoi parlare oggi?</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '84%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? 'var(--theme-color)' : 'var(--card)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: '0.92em', lineHeight: 1.55,
            }}>
              {msg.role === 'assistant'
                ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                : msg.content
              }
            </div>
            {msg.role === 'assistant' && msg.usage && (
              <div style={{ fontSize: '0.62em', color: '#444', marginTop: 3, paddingLeft: 4 }}>
                {msg.usage.model} · {msg.usage.totalTokens} tok · €{msg.usage.costEUR?.toFixed(5)}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: 'var(--card)', borderRadius: '16px 16px 16px 4px', width: 'fit-content', marginBottom: 14 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#555', animation: `typingDot 1.2s infinite ${i * 0.2}s` }} />)}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px max(20px, env(safe-area-inset-bottom, 20px))', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Scrivi o usa la tastiera vocale..."
            inputMode="text"
            rows={1}
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: '0.9em', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)', color: input.trim() && !loading ? '#000' : '#444', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 700, fontSize: '0.9em' }}>
            ↑
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleNewSession}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 12px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.8em' }}>
            🔄 Nuova sessione
          </button>
        </div>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
