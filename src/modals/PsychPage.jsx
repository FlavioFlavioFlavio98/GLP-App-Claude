import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../lib/store'
import { doc, updateDoc, getDoc, increment, arrayUnion } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { toDateString } from '../lib/habitLogic'
import { buildPsychSystemPrompt } from '../lib/psychPrompt'
import { buildGlpContext } from '../lib/psychContext'
import PsychProfilePage from './PsychProfilePage'
import PsychStatsDrawer from './PsychStatsDrawer'

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

function fmtTime(seconds) {
  const s = Math.floor(seconds)
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
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
  const [showStats, setShowStats] = useState(false)
  const [sessionStats, setSessionStats] = useState({ tokens: 0, costEUR: 0 })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [pinMenu, setPinMenu] = useState(null) // { x, y, text }
  const [lastProfileUpdate, setLastProfileUpdate] = useState(() => {
    const p = userData?.psychProfile
    const ts = p?.globalSummary?.lastUpdated || p?.lastUpdated
    return ts ? new Date(ts) : null
  })

  // ── Tracking state ──────────────────────────────────────────────────────────
  const [todayTimeSeconds, setTodayTimeSeconds] = useState(0)
  const [todayActiveSeconds, setTodayActiveSeconds] = useState(0)
  const [todayWords, setTodayWords] = useState(0)
  const isActiveRef = useRef(false) // true while typing or waiting for response
  // Pending increments to batch-save
  const pendingWords = useRef(0)
  const pendingSeconds = useRef(0)
  const pendingActiveSeconds = useRef(0)
  const lastSaveRef = useRef(Date.now())

  const messagesEndRef = useRef(null)
  const isUpdatingRef = useRef(false)

  const fns = getFunctions(getApp(), 'europe-west1')
  const geminiChatFn = httpsCallable(fns, 'geminiChat', { timeout: 60000 })
  const generateDailyEntryFn = httpsCallable(fns, 'generateDailyEntry', { timeout: 90000 })

  // ── Total time ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setTodayTimeSeconds(prev => prev + 1)
      pendingSeconds.current += 1
      if (isActiveRef.current) {
        setTodayActiveSeconds(prev => prev + 1)
        pendingActiveSeconds.current += 1
      }
      // Auto-save every 60s
      if (Date.now() - lastSaveRef.current >= 60000) {
        flushStats()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Mark active for 30s after loading starts/ends
  useEffect(() => {
    if (loading) {
      isActiveRef.current = true
    } else {
      const t = setTimeout(() => { isActiveRef.current = false }, 30000)
      return () => clearTimeout(t)
    }
  }, [loading])

  // Mark active while typing
  useEffect(() => {
    if (input.trim()) {
      isActiveRef.current = true
    }
  }, [input])

  // Save stats on visibility change + unmount (no profile update — only on "Nuova sessione")
  useEffect(() => {
    const handler = async () => { if (document.hidden) await flushStats() }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      flushStats()
    }
  }, [])

  // Pin text — selectionchange listener
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      const txt = sel?.toString().trim()
      if (txt && txt.length > 10) {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setPinMenu({ x: rect.left + rect.width / 2, y: rect.top - 8, text: txt })
      } else {
        setPinMenu(null)
      }
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const flushStats = useCallback(async () => {
    const words = pendingWords.current
    const secs = pendingSeconds.current
    const activeSecs = pendingActiveSeconds.current
    if (words === 0 && secs === 0 && activeSecs === 0) return
    pendingWords.current = 0
    pendingSeconds.current = 0
    pendingActiveSeconds.current = 0
    lastSaveRef.current = Date.now()

    const today = toDateString(new Date())
    try {
      const updates = {}
      if (words > 0) {
        updates['psychStats.totalWordsLifetime'] = increment(words)
        updates[`psychStats.dailyStats.${today}.words`] = increment(words)
      }
      if (secs > 0) {
        updates['psychStats.totalTimeSecondsLifetime'] = increment(secs)
        updates[`psychStats.dailyStats.${today}.timeSeconds`] = increment(secs)
      }
      if (activeSecs > 0) {
        updates['psychStats.totalActiveTimeSecondsLifetime'] = increment(activeSecs)
        updates[`psychStats.dailyStats.${today}.activeTimeSeconds`] = increment(activeSecs)
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', 'flavio'), updates)
      }
      // Update streak
      const today2 = toDateString(new Date())
      const dailyStats = userData?.psychStats?.dailyStats || {}
      const todayStats = { ...dailyStats, [today2]: { timeSeconds: (dailyStats[today2]?.timeSeconds || 0) + secs } }
      const streak = calcPsychStreak(todayStats)
      const longestStreak = Math.max(streak, userData?.psychStats?.longestStreak || 0)
      await updateDoc(doc(db, 'users', 'flavio'), {
        'psychStats.currentStreak': streak,
        'psychStats.longestStreak': longestStreak,
        'psychStats.lastUsedDate': today2,
      })
    } catch (e) { console.warn('[PsychPage] flushStats error:', e) }
  }, [userData])

  function calcPsychStreak(dailyStats) {
    const d = new Date()
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const dateStr = toDateString(d)
      if (!dailyStats[dateStr] || (dailyStats[dateStr].timeSeconds || 0) === 0) break
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  }

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(CHAT_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function pinSelectedText(text) {
    setPinMenu(null)
    window.getSelection()?.removeAllRanges()
    const today = toDateString(new Date())
    const pinnedMoment = { text, savedAt: new Date().toISOString() }
    try {
      await updateDoc(doc(db, 'users', 'flavio'), {
        [`psychProfile.dailyEntries.${today}.pinnedMoments`]: arrayUnion(pinnedMoment),
      })
      actions.showToast('📌 Salvato nel profilo di oggi', '✅')
    } catch (e) {
      // If entry doesn't exist yet, create minimal stub
      await updateDoc(doc(db, 'users', 'flavio'), {
        [`psychProfile.dailyEntries.${today}`]: {
          id: today, date: today, autoGenerated: false, starred: false,
          insights: '', pinnedMoments: [pinnedMoment], connections: [],
        },
      })
      actions.showToast('📌 Salvato nel profilo di oggi', '✅')
    }
  }

  async function generateDailyEntry(msgs) {
    if (isUpdatingRef.current || msgs.length < 2) return
    isUpdatingRef.current = true
    setIsUpdatingProfile(true)
    try {
      const today = toDateString(new Date())
      const existingProfile = userData?.psychProfile || {}
      const existingEntry = existingProfile.dailyEntries?.[today] || null
      const result = await generateDailyEntryFn({
        sessionMessages: msgs.map(m => ({ role: m.role, content: m.content })),
        existingEntries: existingProfile.dailyEntries || {},
        globalSummary: existingProfile.globalSummary || null,
        date: today,
        existingEntry,
      })
      const { entry } = result.data
      const globalUpdate = entry.globalSummaryUpdate || {}

      const newEntry = {
        id: today, date: today, autoGenerated: true,
        starred: existingEntry?.starred || false,
        insights: entry.insights || '',
        patterns: entry.patterns || null,
        openQuestions: entry.openQuestions || null,
        connections: entry.connections || [],
        pinnedMoments: existingEntry?.pinnedMoments || [],
        corrections: existingEntry?.corrections || [],
      }

      const updates = {
        [`psychProfile.dailyEntries.${today}`]: newEntry,
      }
      if (globalUpdate.narrative) {
        updates['psychProfile.globalSummary'] = { ...globalUpdate, lastUpdated: new Date().toISOString() }
        // Update themes in stats
        const themes = [...(globalUpdate.coreThemes || []), ...(globalUpdate.emotionalPatterns || [])]
        updates['psychStats.topThemes'] = themes
        updates['psychStats.profileUpdatesCount'] = increment(1)
      }
      await updateDoc(doc(db, 'users', 'flavio'), updates)
      setLastProfileUpdate(new Date())
      actions.showToast('📅 Entry del giorno salvato', '✅')
    } catch (e) {
      console.error('[PsychPage] generateDailyEntry failed:', e)
      actions.showToast('Errore generazione entry: ' + (e.message || 'Riprova'), '❌')
    } finally {
      isUpdatingRef.current = false
      setIsUpdatingProfile(false)
    }
  }

  async function handleSend(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')

    // Count words
    const wordCount = content.split(/\s+/).filter(Boolean).length
    setTodayWords(prev => prev + wordCount)
    pendingWords.current += wordCount
    isActiveRef.current = true

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
      // Update daily cost
      const today = toDateString(new Date())
      await updateDoc(doc(db, 'users', 'flavio'), {
        [`psychStats.dailyStats.${today}.costEUR`]: increment(usage?.costEUR || 0),
        [`psychStats.dailyStats.${today}.messages`]: increment(1),
        'psychStats.totalMessages': increment(1),
      })
    } catch (e) {
      actions.showToast('Errore: ' + (e.message || 'Riprova'), '❌')
    } finally {
      setLoading(false)
    }
  }

  async function handleNewSession() {
    if (!window.confirm('Iniziare una nuova sessione? La chat sarà resettata.')) return
    await flushStats()
    if (messages.length >= 2) {
      try {
        // 1. Save session metadata
        const sessionEntry = {
          id: `sess_${Date.now()}`,
          date: toDateString(new Date()),
          model,
          messageCount: messages.length,
          totalTokens: sessionStats.tokens,
          totalCostEUR: sessionStats.costEUR,
          words: todayWords,
          durationSeconds: todayTimeSeconds,
        }
        const snap = await getDoc(doc(db, 'users', 'flavio'))
        const existingSessions = snap.data()?.psychSessions || []
        await updateDoc(doc(db, 'users', 'flavio'), {
          psychSessions: [...existingSessions.slice(-49), sessionEntry],
          'psychStats.totalTokensLifetime': increment(sessionStats.tokens),
          'psychStats.totalCostEURLifetime': increment(sessionStats.costEUR),
          'psychStats.totalSessions': increment(1),
          [`psychStats.dailyStats.${toDateString(new Date())}.sessions`]: increment(1),
        })
        // 2. Generate daily diary entry
        await generateDailyEntry(messages)
      } catch (e) { console.warn('[PsychPage] session save failed:', e) }
    }
    setMessages([])
    setSessionStats({ tokens: 0, costEUR: 0 })
    setTodayWords(0)
    setTodayTimeSeconds(0)
    setTodayActiveSeconds(0)
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

  // Lifetime stats from Firestore + today's running totals
  const ps = userData?.psychStats || {}
  const lifetimeWords = (ps.totalWordsLifetime || 0) + pendingWords.current
  const lifetimeTime = ps.totalTimeSecondsLifetime || 0

  if (showProfile) {
    return (
      <PsychProfilePage
        psychProfile={userData?.psychProfile}
        psychSessions={userData?.psychSessions || []}
        psychStats={ps}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowStats(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '0.95em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</button>
          <button onClick={() => setShowProfile(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</button>
        </div>
      </div>

      {/* Model picker */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={() => setShowModelPicker(v => !v)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82em', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
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

      {/* Compact stats widget — clickable */}
      <button
        onClick={() => setShowStats(true)}
        style={{ padding: '5px 16px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, fontSize: '0.7em', color: '#555', display: 'flex', gap: 8, alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        <span>✍️ {todayWords} parole</span>
        <span>⏱ {fmtTime(todayTimeSeconds)} (attivo {fmtTime(todayActiveSeconds)})</span>
        <span style={{ color: '#3a3a3a' }}>•</span>
        <span>lifetime: {lifetimeWords.toLocaleString()} parole · {fmtTime(lifetimeTime)}</span>
      </button>

      {/* Entry generation indicator */}
      <div style={{ padding: '4px 16px', fontSize: '0.68em', color: '#444', flexShrink: 0 }}>
        📓 {profileUpdateLabel ? `Ultimo entry: ${profileUpdateLabel}` : 'Nessun entry — clicca "Nuova sessione" per generarlo'}
        {isUpdatingProfile && <span style={{ color: 'var(--theme-color)' }}> — generando entry...</span>}
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
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#555', animation: `typingDot 1.2s infinite ${i * 0.2}s` }} />)}
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

      {/* Pin menu — appears when text is selected */}
      {pinMenu && (
        <div style={{ position: 'fixed', left: Math.min(Math.max(pinMenu.x - 70, 8), window.innerWidth - 148), top: Math.max(pinMenu.y - 44, 8), zIndex: 10500, pointerEvents: 'all' }}>
          <button onPointerDown={e => { e.preventDefault(); pinSelectedText(pinMenu.text) }}
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '7px 14px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82em', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
            📌 Ricorda questo
          </button>
        </div>
      )}

      {/* Stats Drawer */}
      {showStats && (
        <PsychStatsDrawer
          onClose={() => setShowStats(false)}
          psychStats={ps}
          psychSessions={userData?.psychSessions || []}
          psychProfile={userData?.psychProfile}
          todayWords={todayWords}
          todayTimeSeconds={todayTimeSeconds}
          todayActiveSeconds={todayActiveSeconds}
        />
      )}

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
