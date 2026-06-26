import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../lib/store'
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { toDateString } from '../lib/habitLogic'
import { buildPsychSystemPrompt } from '../lib/psychPrompt'
import { buildGlpContext } from '../lib/psychContext'
import PsychProfilePage from './PsychProfilePage'
import PsychStatsDrawer from './PsychStatsDrawer'
import PsychSearchPage from './PsychSearchPage'
import PsychChatSettings, { loadPrefs, savePrefs, DEFAULT_PREFS } from '../components/PsychChatSettings'
import { exportSessionPdf } from '../lib/psychPdf'

const MODELS = [
  { id: 'gemini-2.5-flash-lite', label: '⚡ Flash-Lite', labelFull: '⚡ Gemini 2.5 Flash-Lite', desc: 'economico e veloce' },
  { id: 'gemini-2.5-flash',      label: '🔵 Flash',      labelFull: '🔵 Gemini 2.5 Flash',      desc: 'bilanciato' },
  { id: 'gemini-2.5-pro',        label: '🟣 Pro',         labelFull: '🟣 Gemini 2.5 Pro',         desc: 'il più intelligente' },
  { id: 'gemini-3.5-flash',      label: '🌟 3.5 Flash',  labelFull: '🌟 Gemini 3.5 Flash',       desc: 'frontier' },
]

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
  if (s < 3600) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}` }
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function getBubbleRadius(style, role) {
  if (style === 'square') return '6px'
  if (style === 'flat') return '0'
  return role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
}

function getDensityPadding(density) {
  if (density === 'compact') return '7px 11px'
  if (density === 'spacious') return '14px 18px'
  return '10px 14px'
}

// Props: sessionId, sessionData, onBack, onClose, onOpenProfile
export default function PsychPage({ sessionId, sessionData, onBack, onClose, onOpenProfile }) {
  const { state, actions } = useApp()
  const { allUsersData } = state
  const userData = allUsersData?.flavio || {}
  const dailyLogs = userData?.dailyLogs || {}

  const [messages, setMessages] = useState(() => sessionData?.messages || [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(sessionData?.model || 'gemini-2.5-flash-lite')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState(() => loadPrefs())
  const [sessionTitle, setSessionTitle] = useState(sessionData?.title || 'Nuova sessione')
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [renameTmp, setRenameTmp] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileEntryGenerated, setProfileEntryGenerated] = useState(sessionData?.profileEntryGenerated || false)
  const [pinMenu, setPinMenu] = useState(null)
  const [reloadBanner, setReloadBanner] = useState(() => {
    const hasHistory = (sessionData?.messages || []).length > 0
    if (!hasHistory) return null
    const chars = (sessionData.messages || []).reduce((n, m) => n + (m.content?.length || 0), 0)
    const estTokens = Math.round(chars / 4)
    const estCost = ((estTokens / 1_000_000) * 0.10 * 0.92).toFixed(5)
    return { tokens: estTokens, cost: estCost }
  })

  // ── Voice input ───────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)

  // ── Reflection mode ───────────────────────────────────────────────────────
  const [showReflectionConfig, setShowReflectionConfig] = useState(false)
  const [reflectionConfig, setReflectionConfig] = useState({ numQ: 5, theme: '' })
  const [reflection, setReflection] = useState(null)
  // null | { questions:[], currentIndex:number, answers:[], done:false } | { done:true, summary:'' }

  // ── Stats tracking ────────────────────────────────────────────────────────
  const [todayTimeSeconds, setTodayTimeSeconds] = useState(0)
  const [todayActiveSeconds, setTodayActiveSeconds] = useState(0)
  const [todayWords, setTodayWords] = useState(0)
  const isActiveRef = useRef(false)
  const pendingWords = useRef(0)
  const pendingSeconds = useRef(0)
  const pendingActiveSeconds = useRef(0)
  const lastSaveRef = useRef(Date.now())
  const titleGeneratedRef = useRef(sessionData?.title && sessionData.title !== 'Nuova sessione')
  const messagesEndRef = useRef(null)
  const isUpdatingRef = useRef(false)

  const fns = getFunctions(getApp(), 'europe-west1')
  const geminiChatFn = httpsCallable(fns, 'geminiChat', { timeout: 60000 })
  const generateDailyEntryFn = httpsCallable(fns, 'generateDailyEntry', { timeout: 90000 })
  const generateSessionTitleFn = httpsCallable(fns, 'generateSessionTitle', { timeout: 30000 })

  useEffect(() => { if (!reloadBanner) return; const t = setTimeout(() => setReloadBanner(null), 5000); return () => clearTimeout(t) }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayTimeSeconds(prev => prev + 1); pendingSeconds.current += 1
      if (isActiveRef.current) { setTodayActiveSeconds(prev => prev + 1); pendingActiveSeconds.current += 1 }
      if (Date.now() - lastSaveRef.current >= 60000) flushStats()
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (loading) { isActiveRef.current = true }
    else { const t = setTimeout(() => { isActiveRef.current = false }, 30000); return () => clearTimeout(t) }
  }, [loading])

  useEffect(() => { if (input.trim()) isActiveRef.current = true }, [input])

  useEffect(() => {
    const handler = async () => { if (document.hidden) await flushStats() }
    document.addEventListener('visibilitychange', handler)
    return () => { document.removeEventListener('visibilitychange', handler); flushStats() }
  }, [])

  // Pin text
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection(); const txt = sel?.toString().trim()
      if (txt && txt.length > 10) {
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        setPinMenu({ x: rect.left + rect.width / 2, y: rect.top - 8, text: txt })
      } else { setPinMenu(null) }
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const flushStats = useCallback(async () => {
    const words = pendingWords.current, secs = pendingSeconds.current, activeSecs = pendingActiveSeconds.current
    if (words === 0 && secs === 0 && activeSecs === 0) return
    pendingWords.current = 0; pendingSeconds.current = 0; pendingActiveSeconds.current = 0; lastSaveRef.current = Date.now()
    const today = toDateString(new Date())
    try {
      const updates = {}
      if (words > 0) { updates['psychStats.totalWordsLifetime'] = increment(words); updates[`psychStats.dailyStats.${today}.words`] = increment(words) }
      if (secs > 0) { updates['psychStats.totalTimeSecondsLifetime'] = increment(secs); updates[`psychStats.dailyStats.${today}.timeSeconds`] = increment(secs) }
      if (activeSecs > 0) { updates['psychStats.totalActiveTimeSecondsLifetime'] = increment(activeSecs); updates[`psychStats.dailyStats.${today}.activeTimeSeconds`] = increment(activeSecs) }
      if (Object.keys(updates).length > 0) await updateDoc(doc(db, 'users', 'flavio'), updates)
    } catch (e) { console.warn('[PsychPage] flushStats error:', e) }
  }, [])

  async function saveMessage(msg, usage) {
    const toSave = { role: msg.role, content: msg.content, timestamp: msg.timestamp || new Date().toISOString(), ...(usage ? { usage } : {}) }
    try {
      await updateDoc(doc(db, 'users', 'flavio'), {
        [`psychSessions.${sessionId}.messages`]: arrayUnion(toSave),
        [`psychSessions.${sessionId}.updatedAt`]: new Date().toISOString(),
        [`psychSessions.${sessionId}.messageCount`]: increment(1),
        [`psychSessions.${sessionId}.model`]: model,
        ...(usage?.totalTokens ? { [`psychSessions.${sessionId}.totalTokens`]: increment(usage.totalTokens) } : {}),
        ...(usage?.costEUR ? { [`psychSessions.${sessionId}.totalCostEUR`]: increment(usage.costEUR) } : {}),
      })
    } catch (e) { console.warn('[PsychPage] saveMessage error:', e) }
  }

  async function maybeGenerateTitle(allMsgs) {
    if (titleGeneratedRef.current || allMsgs.length < 4) return
    titleGeneratedRef.current = true
    try {
      const result = await generateSessionTitleFn({ firstMessages: allMsgs.slice(0, 4) })
      const title = result.data.title
      if (title) {
        setSessionTitle(title)
        await updateDoc(doc(db, 'users', 'flavio'), { [`psychSessions.${sessionId}.title`]: title })
      }
    } catch (e) { console.warn('[PsychPage] generateTitle error:', e) }
  }

  async function pinSelectedText(text) {
    setPinMenu(null); window.getSelection()?.removeAllRanges()
    const today = toDateString(new Date()), pinnedMoment = { text, savedAt: new Date().toISOString() }
    try {
      await updateDoc(doc(db, 'users', 'flavio'), { [`psychProfile.dailyEntries.${today}.pinnedMoments`]: arrayUnion(pinnedMoment) })
    } catch {
      await updateDoc(doc(db, 'users', 'flavio'), { [`psychProfile.dailyEntries.${today}`]: { id: today, date: today, autoGenerated: false, starred: false, insights: '', pinnedMoments: [pinnedMoment], connections: [] } })
    }
    actions.showToast('📌 Salvato nel profilo di oggi', '✅')
  }

  // ── Voice input ───────────────────────────────────────────────────────────
  function startVoiceInput() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) { actions.showToast('Su iOS usa Gboard o la dettatura vocale della tastiera', '🎤'); return }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      actions.showToast('Riconoscimento vocale non supportato su questo browser', '❌'); return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'it-IT'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (event) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else interim += event.results[i][0].transcript
      }
      if (final) setInput(prev => prev + final)
      setInterimText(interim)
    }
    recognition.onerror = (e) => { console.error('Speech error:', e.error); setIsRecording(false); setInterimText('') }
    recognition.onend = () => { setIsRecording(false); setInterimText('') }
    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
  }

  function stopVoiceInput() {
    if (interimText) setInput(prev => prev + interimText)
    recognitionRef.current?.stop()
    setIsRecording(false); setInterimText('')
  }

  // ── Reflection mode ───────────────────────────────────────────────────────
  async function startReflection() {
    setShowReflectionConfig(false)
    setLoading(true)
    const { numQ, theme } = reflectionConfig
    const psychProfile = userData?.psychProfile || null
    const systemPrompt = `Sei in modalità riflessione guidata. Devi preparare esattamente ${numQ} domande per guidare Flavio in una riflessione strutturata${theme ? ` sul tema: ${theme}` : ''}.

REGOLE:
- Le domande devono essere aperte, profonde e personalizzate sul profilo
- Rispondi SOLO con un JSON array di stringhe, nessun testo extra
- Formato: ["domanda1", "domanda2", ...]

PROFILO:
${JSON.stringify(psychProfile?.globalSummary || {}, null, 2)}`

    try {
      const result = await geminiChatFn({
        messages: [{ role: 'user', content: `Genera ${numQ} domande di riflessione${theme ? ` sul tema ${theme}` : ''}` }],
        systemPrompt,
        model,
      })
      let questions = []
      try {
        const txt = result.data.content.replace(/^```json\s*|^```\s*|\s*```$/g, '').trim()
        questions = JSON.parse(txt)
      } catch {
        questions = result.data.content.split('\n').filter(l => l.trim()).slice(0, numQ)
      }
      if (!questions.length) throw new Error('Nessuna domanda generata')

      setReflection({ questions, currentIndex: 0, answers: [], done: false })
      const firstQ = { role: 'assistant', content: questions[0], timestamp: new Date().toISOString(), reflection: true }
      setMessages(prev => [...prev, firstQ])
      saveMessage(firstQ)
    } catch (e) {
      actions.showToast('Errore avvio riflessione: ' + (e.message || 'Riprova'), '❌')
    } finally { setLoading(false) }
  }

  async function handleReflectionAnswer(content) {
    const userMsg = { role: 'user', content, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    saveMessage(userMsg)

    const { questions, currentIndex, answers } = reflection
    const newAnswers = [...answers, { q: questions[currentIndex], a: content }]
    const nextIndex = currentIndex + 1

    if (nextIndex < questions.length) {
      setReflection({ questions, currentIndex: nextIndex, answers: newAnswers, done: false })
      const nextQ = { role: 'assistant', content: questions[nextIndex], timestamp: new Date().toISOString(), reflection: true }
      setMessages(prev => [...prev, nextQ])
      saveMessage(nextQ)
    } else {
      setReflection({ questions, currentIndex: nextIndex, answers: newAnswers, done: true })
      setLoading(true)
      try {
        const summaryPrompt = `Sei in modalità riflessione. Flavio ha risposto a tutte le domande. Genera un riassunto riflessivo profondo che analizza le sue risposte, evidenzia pattern, contraddizioni e insight significativi. Sii diretto e profondo.

DOMANDE E RISPOSTE:
${newAnswers.map((qa, i) => `[${i+1}] D: ${qa.q}\nR: ${qa.a}`).join('\n\n')}`
        const result = await geminiChatFn({
          messages: [{ role: 'user', content: 'Genera il riassunto riflessivo' }],
          systemPrompt: summaryPrompt,
          model,
        })
        const summary = result.data.content
        const summaryMsg = { role: 'assistant', content: summary, timestamp: new Date().toISOString(), reflectionSummary: true, usage: result.data.usage }
        setMessages(prev => [...prev, summaryMsg])
        saveMessage(summaryMsg, result.data.usage)
        setReflection(prev => ({ ...prev, summary }))
      } catch (e) { actions.showToast('Errore riassunto: ' + e.message, '❌') }
      finally { setLoading(false) }
    }
  }

  // ── handleSend with retry ─────────────────────────────────────────────────
  async function handleSend(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput(''); setError(null)
    isActiveRef.current = true
    const wordCount = content.split(/\s+/).filter(Boolean).length
    setTodayWords(prev => prev + wordCount); pendingWords.current += wordCount

    // Reflection mode — don't call Gemini for each answer
    if (reflection && !reflection.done) {
      handleReflectionAnswer(content)
      return
    }

    const userMsg = { role: 'user', content, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setLoading(true)
    saveMessage(userMsg)

    const psychProfile = userData?.psychProfile || null
    const glpContext = buildGlpContext(userData, dailyLogs)
    const systemPrompt = buildPsychSystemPrompt(psychProfile, glpContext)

    let lastErr
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await geminiChatFn({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), systemPrompt, model })
        const { content: reply, usage } = result.data
        const assistantMsg = { role: 'assistant', content: reply, usage, timestamp: new Date().toISOString() }
        const finalMessages = [...newMessages, assistantMsg]
        setMessages(finalMessages)
        saveMessage(assistantMsg, usage)
        const today = toDateString(new Date())
        updateDoc(doc(db, 'users', 'flavio'), {
          [`psychStats.dailyStats.${today}.costEUR`]: increment(usage?.costEUR || 0),
          [`psychStats.dailyStats.${today}.messages`]: increment(1),
          'psychStats.totalMessages': increment(1),
        }).catch(() => {})
        maybeGenerateTitle(finalMessages)
        setLoading(false); return
      } catch (err) {
        lastErr = err; console.error(`[PsychPage] attempt ${attempt}:`, err)
        if (attempt < 3) await sleep(1000 * attempt)
      }
    }
    setLoading(false); setError('Errore nella risposta. Riprova.')
    console.error('[PsychPage] Errore definitivo:', lastErr)
  }

  async function handleSaveToProfile() {
    if (isUpdatingRef.current || messages.length < 2) return
    isUpdatingRef.current = true; setIsUpdatingProfile(true)
    try {
      const today = toDateString(new Date())
      const existingProfile = userData?.psychProfile || {}
      const existingEntry = existingProfile.dailyEntries?.[today] || null
      const result = await generateDailyEntryFn({
        sessionMessages: messages.map(m => ({ role: m.role, content: m.content })),
        existingEntries: existingProfile.dailyEntries || {},
        globalSummary: existingProfile.globalSummary || null,
        date: today, existingEntry,
      })
      const { entry } = result.data
      const globalUpdate = entry.globalSummaryUpdate || {}
      const newEntry = { id: today, date: today, autoGenerated: true, starred: existingEntry?.starred || false, insights: entry.insights || '', patterns: entry.patterns || null, openQuestions: entry.openQuestions || null, connections: entry.connections || [], pinnedMoments: existingEntry?.pinnedMoments || [], corrections: existingEntry?.corrections || [] }
      const updates = { [`psychProfile.dailyEntries.${today}`]: newEntry }
      if (globalUpdate.narrative) {
        updates['psychProfile.globalSummary'] = { ...globalUpdate, lastUpdated: new Date().toISOString() }
        updates['psychStats.topThemes'] = [...(globalUpdate.coreThemes || []), ...(globalUpdate.emotionalPatterns || [])]
        updates['psychStats.profileUpdatesCount'] = increment(1)
      }
      updates[`psychSessions.${sessionId}.profileEntryGenerated`] = true
      await updateDoc(doc(db, 'users', 'flavio'), updates)
      setProfileEntryGenerated(true)
      actions.showToast('📅 Entry salvato nel profilo psicologico', '✅')
    } catch (e) { console.error('[PsychPage] saveToProfile failed:', e); actions.showToast('Errore: ' + (e.message || 'Riprova'), '❌') }
    finally { isUpdatingRef.current = false; setIsUpdatingProfile(false) }
  }

  async function saveTitle() {
    const t = renameTmp.trim(); if (!t) { setRenamingTitle(false); return }
    setSessionTitle(t); setRenamingTitle(false)
    await updateDoc(doc(db, 'users', 'flavio'), { [`psychSessions.${sessionId}.title`]: t })
  }

  function handleExportPdf() {
    const sessData = {
      ...sessionData,
      title: sessionTitle,
      messages,
      model,
    }
    exportSessionPdf({ session: sessData, psychProfile: userData?.psychProfile })
  }

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[0]
  const ps = userData?.psychStats || {}

  // Build the current session object for PDF export
  const currentSession = { ...sessionData, title: sessionTitle, messages, model }

  // Derived prefs
  const msgFontSize = prefs.textSize === 'small' ? '0.83em' : prefs.textSize === 'large' ? '1em' : '0.92em'
  const msgPadding = getDensityPadding(prefs.density)
  const msgMarginBottom = prefs.density === 'compact' ? 8 : prefs.density === 'spacious' ? 20 : 14

  function getPsychBg() {
    if (prefs.psychColor === 'neutral') return 'rgba(60,60,60,0.9)'
    if (prefs.psychColor === 'custom') return prefs.psychColorCustom || '#2a2a2a'
    return 'var(--card)'
  }

  if (showSearch) {
    return <PsychSearchPage
      onClose={() => setShowSearch(false)}
      onOpenSession={(id, data) => { setShowSearch(false); /* navigate handled by parent */ }}
      onOpenProfile={(date) => { setShowSearch(false); setShowProfile(true) }}
    />
  }

  if (showProfile) {
    return (
      <PsychProfilePage psychProfile={userData?.psychProfile} psychSessions={[]} psychStats={ps} onClose={() => setShowProfile(false)} authUserId="flavio" />
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={onBack || onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.4em', cursor: 'pointer', padding: '4px 6px 4px 0', lineHeight: 1, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {renamingTitle ? (
            <input value={renameTmp} onChange={e => setRenameTmp(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setRenamingTitle(false) }}
              onBlur={saveTitle} autoFocus
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--theme-color)', borderRadius: 8, padding: '4px 8px', color: 'var(--text)', fontSize: '0.9em', fontWeight: 700, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ fontWeight: 700, fontSize: '0.95em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionTitle}</div>
          )}
          <div style={{ fontSize: '0.68em', color: 'var(--text-sec)' }}>{selectedModel.label}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => { setRenameTmp(sessionTitle); setRenamingTitle(true) }} title="Rinomina"
            style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.85em', padding: '4px 5px', opacity: 0.55 }}>✏️</button>
          <button onClick={() => setShowSearch(true)} title="Cerca"
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔍</button>
          <button onClick={() => setShowReflectionConfig(true)} title="Modalità Riflessione"
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🪞</button>
          <button onClick={() => setShowSettings(true)} title="Impostazioni chat"
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
          <button onClick={() => setShowStats(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</button>
          <button onClick={() => setShowProfile(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</button>
        </div>
      </div>

      {/* Model picker */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, position: 'relative' }}>
        <button onClick={() => setShowModelPicker(v => !v)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.78em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{selectedModel.labelFull}</span>
          <span style={{ color: '#555', fontSize: '0.85em' }}>· {selectedModel.desc}</span>
          <span style={{ marginLeft: 6, opacity: 0.4 }}>▼</span>
        </button>
        {showModelPicker && (
          <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 100, background: 'var(--card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
            {MODELS.map(m => (
              <button key={m.id} onClick={() => { setModel(m.id); setShowModelPicker(false) }}
                style={{ width: '100%', padding: '9px 14px', background: model === m.id ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82em', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                <span>{m.labelFull}</span>
                <span style={{ color: '#555', fontSize: '0.85em' }}>{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <button onClick={() => setShowStats(true)}
        style={{ padding: '4px 16px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)', flexShrink: 0, fontSize: '0.68em', color: '#555', display: 'flex', gap: 8, alignItems: 'center', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
        <span>✍️ {todayWords} parole</span>
        <span>⏱ {fmtTime(todayTimeSeconds)}</span>
        {reflection && !reflection.done && (
          <span style={{ marginLeft: 'auto', color: 'var(--theme-color)', fontWeight: 700 }}>
            🪞 Domanda {(reflection.currentIndex) + 1}/{reflection.questions.length}
          </span>
        )}
      </button>

      {/* Reload banner */}
      {reloadBanner && (
        <div style={{ margin: '6px 16px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75em', fontWeight: 600 }}>📊 Sessione ricaricata</div>
            <div style={{ fontSize: '0.68em', color: '#555', marginTop: 1 }}>~{reloadBanner.tokens.toLocaleString()} token · €{reloadBanner.cost}</div>
          </div>
          <button onClick={() => setReloadBanner(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1em', padding: '2px 4px' }}>✕</button>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: '0.9em' }}>
            <div style={{ fontSize: '2.5em', marginBottom: 12 }}>🧠</div>
            <div>Di cosa vuoi parlare oggi?</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isReflectionQ = msg.reflection
          const isReflectionSummary = msg.reflectionSummary
          return (
            <div key={i} style={{ marginBottom: msgMarginBottom, display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
              {isReflectionQ && (
                <div style={{ fontSize: '0.65em', color: 'var(--theme-color)', marginBottom: 3, paddingLeft: 4, fontWeight: 700 }}>🪞 Domanda {reflection?.questions ? reflection.questions.indexOf(msg.content) + 1 : ''}</div>
              )}
              {isReflectionSummary && (
                <div style={{ fontSize: '0.65em', color: '#a0d4a0', marginBottom: 3, paddingLeft: 4, fontWeight: 700 }}>🪞 Riassunto Riflessione</div>
              )}
              <div style={{
                maxWidth: '84%', padding: msgPadding,
                borderRadius: getBubbleRadius(prefs.bubbleStyle, msg.role),
                background: isUser ? 'var(--theme-color)' : isReflectionQ ? 'rgba(var(--theme-color-rgb,255,200,0),0.12)' : isReflectionSummary ? 'rgba(100,160,100,0.12)' : getPsychBg(),
                color: isUser ? '#fff' : 'var(--text)',
                fontSize: msgFontSize, lineHeight: 1.55,
                border: isReflectionQ ? '1px solid rgba(var(--theme-color-rgb,255,200,0),0.3)' : isReflectionSummary ? '1px solid rgba(100,200,100,0.3)' : 'none',
              }}>
                {!isUser
                  ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  : msg.content
                }
              </div>
              {!isUser && msg.usage && (
                <div style={{ fontSize: '0.62em', color: '#444', marginTop: 3, paddingLeft: 4 }}>
                  {msg.usage.model} · {msg.usage.totalTokens} tok · €{msg.usage.costEUR?.toFixed(5)}
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 14px', background: 'var(--card)', borderRadius: '16px 16px 16px 4px', width: 'fit-content', marginBottom: 14 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#555', animation: `typingDot 1.2s infinite ${i * 0.2}s` }} />)}
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.83em', color: '#e57373' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '0.9em', padding: '0 4px' }}>✕</button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '8px 16px max(20px, env(safe-area-inset-bottom, 20px))', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)', flexShrink: 0 }}>
        {/* Interim voice text preview */}
        {isRecording && interimText && (
          <div style={{ fontSize: '0.82em', color: '#666', fontStyle: 'italic', marginBottom: 6, padding: '0 2px' }}>{interimText}</div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={isRecording ? '🎤 In ascolto...' : 'Scrivi o usa la tastiera vocale...'}
            inputMode="text" rows={1}
            style={{ flex: 1, background: isRecording ? 'rgba(229,57,53,0.08)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isRecording ? 'rgba(229,57,53,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: '0.9em', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }} />
          {/* Voice button */}
          <button
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            title={isRecording ? 'Ferma registrazione' : 'Registra vocale'}
            style={{ background: isRecording ? '#e53935' : 'rgba(255,255,255,0.08)', color: isRecording ? '#fff' : '#888', border: 'none', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontSize: '1.1em', animation: isRecording ? 'voicePulse 1s infinite' : 'none', flexShrink: 0 }}>
            {isRecording ? '🟥' : '🎤'}
          </button>
          <button onClick={() => handleSend()} disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)', color: input.trim() && !loading ? '#000' : '#444', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 700, fontSize: '0.9em', flexShrink: 0 }}>
            ↑
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleSaveToProfile} disabled={messages.length < 2 || isUpdatingProfile}
            style={{ background: profileEntryGenerated ? 'rgba(57,193,118,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${profileEntryGenerated ? 'rgba(57,193,118,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '7px 12px', color: profileEntryGenerated ? 'var(--success,#4caf50)' : 'var(--text-sec)', cursor: messages.length < 2 || isUpdatingProfile ? 'default' : 'pointer', fontSize: '0.8em', opacity: messages.length < 2 ? 0.4 : 1 }}>
            {isUpdatingProfile ? '⏳ Generando...' : profileEntryGenerated ? '📅 Aggiorna profilo' : '📅 Salva nel profilo'}
          </button>
          <button onClick={handleExportPdf} disabled={messages.length === 0}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 12px', color: 'var(--text-sec)', cursor: messages.length === 0 ? 'default' : 'pointer', fontSize: '0.8em', opacity: messages.length === 0 ? 0.4 : 1 }}>
            ⬇️ PDF
          </button>
        </div>
      </div>

      {/* Pin menu */}
      {pinMenu && (
        <div style={{ position: 'fixed', left: Math.min(Math.max(pinMenu.x - 70, 8), window.innerWidth - 148), top: Math.max(pinMenu.y - 44, 8), zIndex: 10500 }}>
          <button onPointerDown={e => { e.preventDefault(); pinSelectedText(pinMenu.text) }}
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '7px 14px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82em', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
            📌 Ricorda questo
          </button>
        </div>
      )}

      {/* Reflection config modal */}
      {showReflectionConfig && (
        <>
          <div onClick={() => setShowReflectionConfig(false)} style={{ position: 'fixed', inset: 0, zIndex: 10400, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10401, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 6 }}>🪞 Modalità Riflessione</div>
            <div style={{ fontSize: '0.78em', color: '#666', marginBottom: 16, lineHeight: 1.5 }}>Lo psicologo ti farà domande una alla volta per guidarti in una riflessione strutturata.</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72em', color: '#555', fontWeight: 700, marginBottom: 8 }}>Numero di domande</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[3, 5, 7, 10].map(n => (
                  <button key={n} onClick={() => setReflectionConfig(c => ({ ...c, numQ: n }))}
                    style={{ flex: 1, padding: '8px', background: reflectionConfig.numQ === n ? 'var(--theme-color)' : 'rgba(255,255,255,0.05)', border: `1px solid ${reflectionConfig.numQ === n ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, cursor: 'pointer', fontWeight: 700, color: reflectionConfig.numQ === n ? '#000' : '#888', fontSize: '0.88em' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72em', color: '#555', fontWeight: 700, marginBottom: 8 }}>Tema focus (opzionale)</div>
              <input value={reflectionConfig.theme} onChange={e => setReflectionConfig(c => ({ ...c, theme: e.target.value }))}
                placeholder="es. lavoro, relazioni, obiettivi..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: '0.88em', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReflectionConfig(false)}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#666', cursor: 'pointer', fontWeight: 600 }}>
                Annulla
              </button>
              <button onClick={startReflection}
                style={{ flex: 2, padding: '12px', background: 'var(--theme-color)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.95em' }}>
                Inizia riflessione
              </button>
            </div>
          </div>
        </>
      )}

      {/* Stats Drawer */}
      {showStats && (
        <PsychStatsDrawer onClose={() => setShowStats(false)} psychStats={ps} psychSessions={[]} psychProfile={userData?.psychProfile} todayWords={todayWords} todayTimeSeconds={todayTimeSeconds} todayActiveSeconds={todayActiveSeconds} />
      )}

      {/* Settings panel */}
      {showSettings && (
        <PsychChatSettings prefs={prefs} onPrefsChange={setPrefs} onClose={() => setShowSettings(false)} />
      )}

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes voicePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.92); }
        }
      `}</style>
    </div>
  )
}
