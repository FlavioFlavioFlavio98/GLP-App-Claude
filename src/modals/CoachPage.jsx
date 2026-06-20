import { useState, useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { useCoach, resetSessionStats, getCoachStats } from '../hooks/useCoach'
import { doc, setDoc, updateDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { toDateString } from '../lib/habitLogic'
import '../lib/chartSetup'
import { Line } from 'react-chartjs-2'

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'Come sto andando questa settimana?',
  'Qual è la mia abitudine più debole?',
  'Cosa dovrei migliorare?',
  'Analizza il mio equilibrio tra categorie',
  'Come influisce il mio mood sulle abitudini?',
  'Sono sulla strada giusta per i miei obiettivi?',
  'Dimmi qualcosa che non so di me stesso',
]

const GOAL_CATEGORIES = ['Salute', 'Sport', 'Mente', 'Lavoro', 'Relazioni', 'Finanze', 'Hobby', 'Generale']

const TONE_LABELS = { positivo: '😊', neutro: '😐', preoccupato: '😟', frustrato: '😤', motivato: '🔥' }
const TONE_COLORS = { positivo: '#4ade80', neutro: '#888', preoccupato: '#fb923c', frustrato: '#ef4444', motivato: '#facc15' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekKey() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayN = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayN)
  const wk = Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}

function getWeekBounds() {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { weekStart: toDateString(monday), weekEnd: toDateString(sunday) }
}

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

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachPage() {
  const { state, actions } = useApp()
  const { modal, authUserId, allUsersData } = state

  const userData = allUsersData?.flavio
  const dailyLogs = userData?.dailyLogs || {}
  const tags = userData?.tags || []
  const avatar = userData?.profile?.avatar || '🧑'

  const { sendMessage, generateWeeklyReport, summarizeConversation } = useCoach(userData, dailyLogs, tags)

  const weekKey = getWeekKey()
  const chatStorageKey = 'glp_coach_chat_flavio'
  const reportStorageKey = `glp_coach_report_${weekKey}`

  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(chatStorageKey) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(reportStorageKey) || 'null') } catch { return null }
  })
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summarizing, setSummarizing] = useState(false)
  const [statsCollapsed, setStatsCollapsed] = useState(true)
  const [coachStats, setCoachStats] = useState(() => getCoachStats())

  // Memory modal
  const [showMemory, setShowMemory] = useState(false)
  const [selectedMemoryConv, setSelectedMemoryConv] = useState(null)

  // Past reports
  const [showPastReports, setShowPastReports] = useState(false)
  const [pastReports, setPastReports] = useState([])
  const [selectedPastReport, setSelectedPastReport] = useState(null)

  // Diary report
  const [updatingDiaries, setUpdatingDiaries] = useState(false)
  const [diaryReport, setDiaryReport] = useState(null) // array of habitUpdates | null
  const [savedDiaryIds, setSavedDiaryIds] = useState(new Set())

  // Goals
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', category: 'Generale', targetDate: '', notes: '' })

  const messagesEndRef = useRef(null)
  const autoGenerateRef = useRef(false)

  const coachMemory = userData?.coachMemory?.conversations || []
  const coachGoals  = userData?.coachGoals || []

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(chatStorageKey, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (modal === 'coach' && state.modalPayload?.autoGenerate && !report && !reportLoading && !autoGenerateRef.current) {
      autoGenerateRef.current = true
      handleGenerateReport()
    }
    if (modal === 'coach' && state.modalPayload?.prefill) {
      setInput(state.modalPayload.prefill)
      setActiveTab('chat')
    }
  }, [modal])

  if (modal !== 'coach') return null
  if (authUserId !== 'flavio') return null

  // ── Chat handlers ──────────────────────────────────────────────────────────

  async function handleSend(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')
    setError(null)
    const newMessages = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const { content: reply, usage } = await sendMessage(newMessages.map(m => ({ role: m.role, content: m.content })))
      setMessages(prev => [...prev, { role: 'assistant', content: reply, usage: usage ? { totalTokens: usage.totalTokens, costUSD: usage.costUSD } : undefined }])
      setCoachStats(getCoachStats())
    } catch (e) {
      console.error('[CoachPage] sendMessage error:', e)
      setError(`Errore: ${e.code || e.message || 'sconosciuto'}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true)
    setError(null)
    try {
      const content = await generateWeeklyReport()
      const { weekStart, weekEnd } = getWeekBounds()
      const newReport = { content, generatedAt: Date.now(), weekStart, weekEnd }
      localStorage.setItem(reportStorageKey, JSON.stringify(newReport))
      setReport(newReport)
      try {
        await setDoc(doc(db, 'users', 'flavio'),
          { coachReports: { [weekKey]: { ...newReport, generatedAt: Timestamp.fromMillis(newReport.generatedAt) } } },
          { merge: true })
      } catch { /* non critico */ }
    } catch (e) {
      setError(`Errore: ${e.code || e.message || 'sconosciuto'}`)
    } finally {
      setReportLoading(false)
    }
  }

  async function handleNewChat() {
    if (!window.confirm('Iniziare una nuova conversazione? La cronologia sarà salvata nella memoria.')) return
    // Save to memory and update habit diaries
    if (messages.length >= 2) {
      setSummarizing(true)
      try {
        // 1. Summarize conversation → memory
        const { summary, tone, toneScore } = await summarizeConversation(
          messages.map(m => ({ role: m.role, content: m.content }))
        )
        const convEntry = {
          id: `conv_${Date.now()}`,
          date: toDateString(new Date()),
          summary,
          tone,
          toneScore,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }
        const existing = coachMemory.slice(-29)
        const updated = [...existing, convEntry]
        await setDoc(doc(db, 'users', 'flavio'), { coachMemory: { conversations: updated } }, { merge: true })

        // 2. Update habit diaries from conversation
        try {
          const fns = getFunctions(getApp(), 'europe-west1')
          const updateHabitDiariesFn = httpsCallable(fns, 'updateHabitDiaries', { timeout: 30000 })
          const result = await updateHabitDiariesFn({
            conversationMessages: messages.map(m => ({ role: m.role, content: m.content })),
            habits: userData?.habits || [],
          })
          const { habitUpdates = [] } = result.data
          if (habitUpdates.length > 0) {
            const firestoreUpdates = {}
            const today = toDateString(new Date())
            for (const update of habitUpdates) {
              const habitId = update.habitId
              const existingEntries = userData?.habitDiaries?.[habitId]?.entries || []
              const newEntry = {
                id: `entry_${Date.now()}_${habitId}`,
                date: today,
                source: 'coach',
                narrative: update.narrative,
                keyPoints: update.keyPoints,
                rawConversationSummary: update.rawSummary,
              }
              firestoreUpdates[`habitDiaries.${habitId}`] = {
                habitName: update.habitName,
                entries: [...existingEntries, newEntry],
                lastUpdated: new Date().toISOString(),
              }
            }
            await updateDoc(doc(db, 'users', 'flavio'), firestoreUpdates)
            const names = habitUpdates.map(u => u.habitName).join(', ')
            actions.showToast(`📖 Diario aggiornato: ${names}`, '🤖')
          }
        } catch (e) {
          console.warn('[CoachPage] habit diaries update failed (non-critical):', e)
        }
      } catch (e) {
        console.warn('[CoachPage] summarize failed (non-critical):', e)
      } finally {
        setSummarizing(false)
      }
    }
    setMessages([])
    localStorage.removeItem(chatStorageKey)
    resetSessionStats()
    setCoachStats(getCoachStats())
  }

  async function saveDiaryEntry(update) {
    const habitId = update.habitId
    const existingEntries = userData?.habitDiaries?.[habitId]?.entries || []
    const newEntry = {
      id: `entry_${Date.now()}_${habitId}`,
      date: toDateString(new Date()),
      source: 'coach',
      narrative: update.narrative,
      keyPoints: update.keyPoints,
      rawConversationSummary: update.rawSummary,
    }
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`habitDiaries.${habitId}`]: {
        habitName: update.habitName,
        entries: [...existingEntries, newEntry],
        lastUpdated: new Date().toISOString(),
      }
    })
    setSavedDiaryIds(prev => new Set([...prev, habitId]))
    actions.showToast(`📖 Diario aggiornato: ${update.habitName}`, '✅')
  }

  async function handleUpdateDiaries() {
    if (messages.length < 2) {
      actions.showToast('Inizia una conversazione prima di aggiornare i diari.', '💬')
      return
    }
    setUpdatingDiaries(true)
    setSavedDiaryIds(new Set())
    setDiaryReport(null)
    try {
      const fns = getFunctions(getApp(), 'europe-west1')
      const updateHabitDiariesFn = httpsCallable(fns, 'updateHabitDiaries', { timeout: 30000 })
      const result = await updateHabitDiariesFn({
        conversationMessages: messages.map(m => ({ role: m.role, content: m.content })),
        habits: userData?.habits || [],
      })
      setDiaryReport(result.data.habitUpdates || [])
    } catch (e) {
      actions.showToast('Errore: ' + (e.message || 'Riprova'), '❌')
    } finally {
      setUpdatingDiaries(false)
    }
  }

  async function handleLoadPastReports() {
    setShowPastReports(true)
    try {
      const snap = await getDoc(doc(db, 'users', 'flavio'))
      const reports = snap.data()?.coachReports || {}
      const list = Object.entries(reports)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, val]) => ({
          key, content: val.content, weekStart: val.weekStart, weekEnd: val.weekEnd,
          generatedAt: val.generatedAt?.toMillis ? val.generatedAt.toMillis() : val.generatedAt,
        }))
      setPastReports(list)
    } catch (e) { console.error(e) }
  }

  // ── Goal handlers ──────────────────────────────────────────────────────────

  async function handleSaveGoal() {
    if (!goalForm.title.trim()) return
    const goals = [...coachGoals]
    if (editingGoal) {
      const idx = goals.findIndex(g => g.id === editingGoal.id)
      if (idx >= 0) goals[idx] = { ...editingGoal, ...goalForm }
    } else {
      goals.push({
        id: `goal_${Date.now()}`,
        ...goalForm,
        status: 'active',
        createdAt: Date.now(),
      })
    }
    await setDoc(doc(db, 'users', 'flavio'), { coachGoals: goals }, { merge: true })
    setShowAddGoal(false)
    setEditingGoal(null)
    setGoalForm({ title: '', description: '', category: 'Generale', targetDate: '', notes: '' })
    actions.showToast('Obiettivo salvato!', '🎯')
  }

  async function handleGoalStatus(goalId, status) {
    const goals = coachGoals.map(g => g.id === goalId
      ? { ...g, status, [status === 'achieved' ? 'achievedAt' : 'abandonedAt']: toDateString(new Date()) }
      : g)
    await setDoc(doc(db, 'users', 'flavio'), { coachGoals: goals }, { merge: true })
    actions.showToast(status === 'achieved' ? 'Obiettivo raggiunto! 🎉' : 'Obiettivo abbandonato', status === 'achieved' ? '✅' : '📦')
  }

  async function handleDeleteGoal(goalId) {
    if (!window.confirm('Eliminare questo obiettivo?')) return
    const goals = coachGoals.filter(g => g.id !== goalId)
    await setDoc(doc(db, 'users', 'flavio'), { coachGoals: goals }, { merge: true })
  }

  async function handleClearMemory() {
    if (!window.confirm('Cancellare tutta la memoria del Coach? Non sarà recuperabile.')) return
    await setDoc(doc(db, 'users', 'flavio'), { coachMemory: { conversations: [] } }, { merge: true })
    setShowMemory(false)
    actions.showToast('Memoria cancellata', '🗑️')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'chat', label: '💬 Chat' },
    { id: 'goals', label: '🎯 Obiettivi' },
    { id: 'analysis', label: '📊 Analisi' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)' }}>
        <span style={{ fontSize: '1.4em' }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1em' }}>Il tuo Coach</div>
          <div style={{ fontSize: '0.65em', color: '#555' }}>Powered by Claude AI</div>
        </div>
        {/* Memory button */}
        <button onClick={() => setShowMemory(true)} style={chipStyle} title="Memoria conversazioni">
          📚 {coachMemory.length > 0 ? coachMemory.length : ''}
        </button>
        <button
          onClick={() => { setShowMemory(false); setSelectedMemoryConv(null); setShowPastReports(false); setSelectedPastReport(null); actions.closeModal() }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text)' }}
        >✕</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: '0.78em', fontWeight: activeTab === tab.id ? 700 : 400,
            background: 'transparent',
            color: activeTab === tab.id ? 'var(--theme-color)' : '#555',
            borderBottom: `2px solid ${activeTab === tab.id ? 'var(--theme-color)' : 'transparent'}`,
            transition: 'all 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Memory modal overlay */}
      {showMemory && (
        <MemoryModal
          memory={coachMemory}
          selected={selectedMemoryConv}
          onSelect={setSelectedMemoryConv}
          onBack={() => { if (selectedMemoryConv) setSelectedMemoryConv(null); else setShowMemory(false) }}
          onClear={handleClearMemory}
        />
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            loading={loading}
            summarizing={summarizing}
            report={report}
            reportLoading={reportLoading}
            weekKey={weekKey}
            error={error}
            avatar={avatar}
            onRegenerate={handleGenerateReport}
            showPastReports={showPastReports}
            pastReports={pastReports}
            selectedPastReport={selectedPastReport}
            onSelectPastReport={setSelectedPastReport}
            onShowPastReports={handleLoadPastReports}
            onBackFromReports={() => { if (selectedPastReport) setSelectedPastReport(null); else setShowPastReports(false) }}
            messagesEndRef={messagesEndRef}
            statsCollapsed={statsCollapsed}
            onToggleStats={() => setStatsCollapsed(v => !v)}
            coachStats={coachStats}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsTab
            goals={coachGoals}
            tags={tags}
            showAdd={showAddGoal}
            editingGoal={editingGoal}
            goalForm={goalForm}
            onFormChange={setGoalForm}
            onShowAdd={() => { setShowAddGoal(true); setEditingGoal(null); setGoalForm({ title: '', description: '', category: 'Generale', targetDate: '', notes: '' }) }}
            onEdit={g => { setEditingGoal(g); setGoalForm({ title: g.title, description: g.description, category: g.category, targetDate: g.targetDate || '', notes: g.notes || '' }); setShowAddGoal(true) }}
            onSave={handleSaveGoal}
            onCancel={() => { setShowAddGoal(false); setEditingGoal(null) }}
            onStatus={handleGoalStatus}
            onDelete={handleDeleteGoal}
          />
        )}
        {activeTab === 'analysis' && (
          <AnalysisTab memory={coachMemory} />
        )}
      </div>

      {/* Bottom input — only in chat tab, not in memory/report sub-views */}
      {activeTab === 'chat' && !showMemory && !showPastReports && !selectedPastReport && (
        <div style={{ padding: '10px 16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => handleSend(q)} style={chipStyle} disabled={loading}>
                {q}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Chiedi qualcosa al Coach..."
              rows={1}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: '0.9em', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
            />
            <button onClick={() => handleSend()} disabled={!input.trim() || loading} style={{ background: input.trim() && !loading ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)', color: input.trim() && !loading ? '#000' : '#444', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 700, fontSize: '0.9em' }}>
              ↑
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={handleNewChat} style={{ ...chipStyle, opacity: summarizing ? 1 : 0.7 }} disabled={summarizing}>
              {summarizing ? '💾 Salvando...' : '🔄 Nuova conversazione'}
            </button>
            <button
              onClick={handleUpdateDiaries}
              disabled={updatingDiaries || messages.length < 2}
              style={{ ...chipStyle, opacity: updatingDiaries ? 1 : messages.length < 2 ? 0.3 : 0.7 }}
            >
              {updatingDiaries ? '🔍 Analizzando...' : '📖 Aggiorna diari'}
            </button>
            <button onClick={showPastReports ? () => setShowPastReports(false) : handleLoadPastReports} style={{ ...chipStyle, opacity: 0.7 }}>
              📋 Report precedenti
            </button>
          </div>
        </div>
      )}

      {/* Diary Report Modal */}
      {diaryReport !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={e => e.target === e.currentTarget && setDiaryReport(null)}>
          <div style={{
            width: '100%', background: 'var(--card-solid)',
            borderRadius: '20px 20px 0 0',
            maxHeight: '85vh', overflowY: 'auto',
            padding: '20px 16px max(24px, env(safe-area-inset-bottom, 24px))',
          }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ fontWeight: 700, fontSize: '1.05em', marginBottom: 4 }}>📖 Report aggiornamento diari</div>

            {diaryReport.length === 0 ? (
              <div style={{ color: 'var(--text-sec)', padding: '20px 0', fontSize: '0.9em' }}>
                Nessuna informazione sulle abitudini trovata in questa conversazione.
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.82em', color: 'var(--text-sec)', marginBottom: 16 }}>
                  Ho trovato informazioni su <strong>{diaryReport.length}</strong> {diaryReport.length === 1 ? 'abitudine' : 'abitudini'}:
                </div>

                {diaryReport.map(update => {
                  const habitId = update.habitId
                  const isSaved = savedDiaryIds.has(habitId)
                  return (
                    <div key={habitId} style={{
                      background: isSaved ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSaved ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 14, padding: '14px', marginBottom: 12,
                      transition: 'background 0.2s, border 0.2s',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95em', marginBottom: 8 }}>
                        {update.habitName}
                        {isSaved && <span style={{ marginLeft: 8, fontSize: '0.75em', color: '#4caf50' }}>✓ Salvato</span>}
                      </div>
                      {update.narrative && (
                        <div style={{ fontStyle: 'italic', color: 'var(--text-sec)', fontSize: '0.85em', lineHeight: 1.5, marginBottom: 10 }}>
                          "{update.narrative}"
                        </div>
                      )}
                      {update.keyPoints?.whenFails && (
                        <div style={{ fontSize: '0.8em', color: 'var(--text-sec)', marginBottom: 4 }}>
                          ⚠️ <strong>Fallisce quando:</strong> {update.keyPoints.whenFails}
                        </div>
                      )}
                      {update.keyPoints?.coachTips?.length > 0 && (
                        <div style={{ fontSize: '0.8em', color: 'var(--text-sec)', marginBottom: 4 }}>
                          💡 <strong>Consiglio:</strong> {update.keyPoints.coachTips[0]}
                        </div>
                      )}
                      {update.keyPoints?.patterns && (
                        <div style={{ fontSize: '0.8em', color: 'var(--text-sec)', marginBottom: 10 }}>
                          📊 <strong>Pattern:</strong> {update.keyPoints.patterns}
                        </div>
                      )}
                      {!isSaved && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => saveDiaryEntry(update)}
                            style={{ flex: 1, padding: '9px', background: 'var(--theme-color)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: '0.85em', cursor: 'pointer' }}
                          >✓ Salva</button>
                          <button
                            onClick={() => setSavedDiaryIds(prev => new Set([...prev, habitId]))}
                            style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-sec)', fontSize: '0.85em', cursor: 'pointer' }}
                          >✗ Salta</button>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={async () => {
                      const unsaved = diaryReport.filter(u => !savedDiaryIds.has(u.habitId))
                      for (const update of unsaved) await saveDiaryEntry(update)
                    }}
                    style={{ flex: 1, padding: '13px', background: 'var(--theme-color)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: '0.92em', cursor: 'pointer' }}
                  >
                    Salva tutto
                  </button>
                  <button
                    onClick={() => setDiaryReport(null)}
                    style={{ padding: '13px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-sec)', fontSize: '0.88em', cursor: 'pointer' }}
                  >
                    Chiudi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

function ChatTab({ messages, loading, summarizing, report, reportLoading, weekKey, error, avatar, onRegenerate, showPastReports, pastReports, selectedPastReport, onSelectPastReport, onShowPastReports, onBackFromReports, messagesEndRef, statsCollapsed, onToggleStats, coachStats }) {
  if (selectedPastReport) return (
    <div>
      <button onClick={onBackFromReports} style={{ ...chipStyle, marginBottom: 16 }}>← Lista report</button>
      <ReportCard report={selectedPastReport} onRegenerate={null} loading={false} />
    </div>
  )
  if (showPastReports) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBackFromReports} style={chipStyle}>← Indietro</button>
        <span style={{ fontWeight: 700 }}>Report settimanali</span>
      </div>
      {pastReports.length === 0 && <div style={{ color: '#555', textAlign: 'center', marginTop: 40, fontSize: '0.85em' }}>Nessun report salvato</div>}
      {pastReports.map(r => (
        <div key={r.key} onClick={() => onSelectPastReport(r)} style={{ ...cardStyle, cursor: 'pointer', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: 4 }}>{r.key} — {r.weekStart} / {r.weekEnd}</div>
          <div style={{ fontSize: '0.78em', color: '#666' }}>{r.content?.slice(0, 100)}…</div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* Stats card */}
      <div
        onClick={onToggleStats}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '8px 12px',
          marginBottom: 10,
          cursor: 'pointer',
          fontSize: '0.8em',
          color: '#666',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📊 Statistiche</span>
          <span>{statsCollapsed ? '▼' : '▲'}</span>
        </div>
        {!statsCollapsed && coachStats && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              ['Modello', 'claude-haiku-4-5'],
              ['Token sessione', (coachStats.sessionTokens || 0).toLocaleString()],
              ['Costo sessione', `$${(coachStats.sessionCostUSD || 0).toFixed(4)}`],
              ['Costo lifetime', `$${(coachStats.totalCostUSD || 0).toFixed(4)}`],
              ['Messaggi totali', coachStats.totalMessages || 0],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}:</span>
                <span style={{ color: '#888' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ReportCard report={report} onRegenerate={onRegenerate} loading={reportLoading} weekKey={weekKey} />
      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82em', color: '#ef4444' }}>{error}</div>}
      {messages.length === 0 && !summarizing && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#444', fontSize: '0.85em' }}>
          <div style={{ fontSize: '2em', marginBottom: 8 }}>🤖</div>
          Fai una domanda al Coach o usa uno dei suggerimenti sotto.
        </div>
      )}
      {summarizing && <div style={{ textAlign: 'center', padding: '12px 0', color: '#555', fontSize: '0.82em' }}>💾 Salvataggio conversazione in memoria...</div>}
      {messages.map((msg, i) => <MessageBubble key={i} msg={msg} avatar={avatar} />)}
      {loading && <TypingIndicator />}
      <div ref={messagesEndRef} style={{ height: 8 }} />
    </>
  )
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab({ goals, tags, showAdd, editingGoal, goalForm, onFormChange, onShowAdd, onEdit, onSave, onCancel, onStatus, onDelete }) {
  const active    = goals.filter(g => g.status === 'active')
  const completed = goals.filter(g => g.status === 'achieved')
  const abandoned = goals.filter(g => g.status === 'abandoned')

  const tagOptions = [...new Set([...GOAL_CATEGORIES, ...tags.map(t => t.name)])]

  if (showAdd) return (
    <div>
      <h4 style={{ margin: '0 0 16px', fontSize: '0.95em' }}>{editingGoal ? 'Modifica obiettivo' : 'Nuovo obiettivo'}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={goalForm.title} onChange={e => onFormChange(f => ({ ...f, title: e.target.value }))}
          placeholder="Titolo (es. Perdere 5kg)" style={inputStyle} />
        <textarea value={goalForm.description} onChange={e => onFormChange(f => ({ ...f, description: e.target.value }))}
          placeholder="Descrizione dettagliata..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        <select value={goalForm.category} onChange={e => onFormChange(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
          {tagOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <label style={{ fontSize: '0.75em', color: '#666', display: 'block', marginBottom: 4 }}>Data target (opzionale)</label>
          <input type="date" value={goalForm.targetDate} onChange={e => onFormChange(f => ({ ...f, targetDate: e.target.value }))} style={inputStyle} />
        </div>
        <textarea value={goalForm.notes} onChange={e => onFormChange(f => ({ ...f, notes: e.target.value }))}
          placeholder="Note aggiuntive..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onSave} className="btn-main" style={{ flex: 1, fontSize: '0.85em' }}>Salva</button>
          <button onClick={onCancel} className="btn-sec" style={{ flex: 1, fontSize: '0.85em' }}>Annulla</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 700 }}>🎯 Obiettivi attivi ({active.length})</div>
        <button onClick={onShowAdd} style={{ ...chipStyle, background: 'var(--theme-glow)', border: '1px solid var(--theme-color)', color: 'var(--theme-color)' }}>+ Aggiungi</button>
      </div>

      {active.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#444', fontSize: '0.85em' }}>
          Nessun obiettivo attivo — aggiungine uno!
        </div>
      )}

      {active.map(g => <GoalCard key={g.id} goal={g} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />)}

      {completed.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginTop: 24, marginBottom: 12, fontSize: '0.88em', color: '#4ade80' }}>✅ Completati ({completed.length})</div>
          {completed.map(g => <GoalCard key={g.id} goal={g} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} completed />)}
        </>
      )}
      {abandoned.length > 0 && (
        <>
          <div style={{ fontWeight: 700, marginTop: 20, marginBottom: 12, fontSize: '0.88em', color: '#555' }}>📦 Abbandonati ({abandoned.length})</div>
          {abandoned.map(g => <GoalCard key={g.id} goal={g} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />)}
        </>
      )}
      <div style={{ height: 40 }} />
    </div>
  )
}

function GoalCard({ goal, onEdit, onStatus, onDelete, completed }) {
  const [expanded, setExpanded] = useState(false)
  const days = daysUntil(goal.targetDate)

  return (
    <div style={{ ...cardStyle, marginBottom: 10, opacity: completed ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{goal.title}</div>
          <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2 }}>
            {goal.category}
            {goal.targetDate && <span style={{ marginLeft: 8, color: days !== null && days < 30 && !completed ? '#ef4444' : '#555' }}>
              {completed ? `✅ ${goal.achievedAt || ''}` : days !== null ? ` · ${days > 0 ? `${days}g` : 'Scaduto'}` : ''}
            </span>}
          </div>
        </div>
        <span style={{ color: '#444', fontSize: '0.8em' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          {goal.description && <div style={{ fontSize: '0.82em', color: '#aaa', marginBottom: 8 }}>{goal.description}</div>}
          {goal.notes && <div style={{ fontSize: '0.75em', color: '#555', marginBottom: 10 }}>📝 {goal.notes}</div>}
          {goal.status === 'active' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onEdit(goal)} style={chipStyle}>✏️ Modifica</button>
              <button onClick={() => onStatus(goal.id, 'achieved')} style={{ ...chipStyle, color: '#4ade80', borderColor: '#4ade8044' }}>✅ Raggiunto</button>
              <button onClick={() => onStatus(goal.id, 'abandoned')} style={{ ...chipStyle, opacity: 0.5 }}>📦 Abbandona</button>
              <button onClick={() => onDelete(goal.id)} style={{ ...chipStyle, color: '#ef4444', opacity: 0.7 }}>🗑️</button>
            </div>
          )}
          {goal.status !== 'active' && (
            <button onClick={() => onDelete(goal.id)} style={{ ...chipStyle, color: '#ef4444', opacity: 0.7 }}>🗑️ Elimina</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────

function AnalysisTab({ memory }) {
  const sorted = [...memory].sort((a, b) => a.date.localeCompare(b.date))
  const last30 = sorted.slice(-30)

  if (last30.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: '0.85em' }}>
      <div style={{ fontSize: '2em', marginBottom: 8 }}>📊</div>
      Nessuna conversazione salvata. Inizia a chattare con il Coach!
    </div>
  )

  // Tone line chart
  const chartData = {
    labels: last30.map(c => c.date.slice(5)), // MM-DD
    datasets: [{
      data: last30.map(c => c.toneScore || 3),
      borderColor: 'var(--theme-color)',
      backgroundColor: 'var(--theme-glow)',
      tension: 0.4,
      pointRadius: 4,
      fill: true,
    }],
  }
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `Tono: ${ctx.raw}/5` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#555', font: { size: 9 }, maxTicksLimit: 8 } },
      y: { min: 1, max: 5, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555', stepSize: 1 } },
    },
  }

  // Weekly average tone
  const recentTones = last30.slice(-5)
  const avgTone = recentTones.length > 0
    ? (recentTones.reduce((s, c) => s + (c.toneScore || 3), 0) / recentTones.length).toFixed(1)
    : null
  const lastTone = last30[last30.length - 1]?.tone || 'neutro'

  // Tone frequency
  const toneCounts = {}
  last30.forEach(c => { const t = c.tone || 'neutro'; toneCounts[t] = (toneCounts[t] || 0) + 1 })
  const toneEntries = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])

  // Topic frequency (word freq from summaries)
  const TOPIC_WORDS = ['meditazione', 'sport', 'esercizio', 'lavoro', 'sonno', 'dieta', 'alimentazione', 'stress', 'relazioni', 'obiettiv', 'abitudin', 'peso', 'energia', 'focus', 'disciplina']
  const topicCounts = {}
  last30.forEach(c => {
    const text = (c.summary || '').toLowerCase()
    TOPIC_WORDS.forEach(w => { if (text.includes(w)) topicCounts[w] = (topicCounts[w] || 0) + 1 })
  })
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div>
      {/* Current mood summary */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: '2em' }}>{TONE_LABELS[lastTone] || '😐'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9em' }}>Stato mentale recente</div>
          <div style={{ fontSize: '0.75em', color: '#666' }}>
            {lastTone.charAt(0).toUpperCase() + lastTone.slice(1)} · Media ultime 5: {avgTone}/5
          </div>
        </div>
      </div>

      {/* Tone chart */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88em', marginBottom: 10 }}>Tono conversazioni (ultimi {last30.length})</div>
        <div style={{ height: 130 }}>
          <Line data={chartData} options={chartOptions} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {toneEntries.map(([tone, count]) => (
            <div key={tone} style={{ ...chipStyle, color: TONE_COLORS[tone] || '#888', borderColor: (TONE_COLORS[tone] || '#888') + '44' }}>
              {TONE_LABELS[tone]} {tone} ({count})
            </div>
          ))}
        </div>
      </div>

      {/* Topics */}
      {topTopics.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88em', marginBottom: 10 }}>Argomenti più discussi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topTopics.map(([topic, count]) => (
              <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: '0.78em', color: '#aaa', width: 100, textTransform: 'capitalize' }}>{topic}</div>
                <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                  <div style={{ width: `${(count / last30.length) * 100}%`, height: '100%', background: 'var(--theme-color)', borderRadius: 6, opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: '0.75em', color: '#555', width: 20, textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last conversations */}
      <div style={{ fontWeight: 700, fontSize: '0.88em', marginBottom: 10 }}>Ultime conversazioni</div>
      {[...last30].reverse().slice(0, 5).map(c => (
        <div key={c.id} style={{ ...cardStyle, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75em', color: '#555' }}>{c.date}</span>
            <span style={{ fontSize: '0.75em' }}>{TONE_LABELS[c.tone] || '😐'} {c.tone}</span>
          </div>
          <div style={{ fontSize: '0.8em', color: '#aaa', lineHeight: 1.5 }}>{c.summary}</div>
        </div>
      ))}
      <div style={{ height: 40 }} />
    </div>
  )
}

// ─── Memory Modal ─────────────────────────────────────────────────────────────

function MemoryModal({ memory, selected, onSelect, onBack, onClear }) {
  const sorted = [...memory].reverse()

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onBack} style={chipStyle}>{selected ? '← Indietro' : '← Chiudi'}</button>
        <span style={{ flex: 1, fontWeight: 700 }}>📚 {selected ? selected.date : `Memoria (${memory.length})`}</span>
        {!selected && memory.length > 0 && (
          <button onClick={onClear} style={{ ...chipStyle, color: '#ef4444', opacity: 0.8 }}>🗑️ Cancella</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {selected ? (
          <>
            <div style={{ fontSize: '0.78em', color: '#666', marginBottom: 4 }}>Tono: {TONE_LABELS[selected.tone] || '😐'} {selected.tone} · Score {selected.toneScore}/5</div>
            <div style={{ fontSize: '0.82em', color: '#aaa', marginBottom: 14, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>{selected.summary}</div>
            {(selected.messages || []).map((m, i) => <MessageBubble key={i} msg={m} avatar="🧑" />)}
          </>
        ) : (
          <>
            {sorted.length === 0 && <div style={{ textAlign: 'center', color: '#444', marginTop: 40 }}>Nessuna conversazione salvata</div>}
            {sorted.map(c => (
              <div key={c.id} onClick={() => onSelect(c)} style={{ ...cardStyle, cursor: 'pointer', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78em', fontWeight: 600 }}>{c.date}</span>
                  <span style={{ fontSize: '0.75em' }}>{TONE_LABELS[c.tone] || '😐'} {c.tone}</span>
                </div>
                <div style={{ fontSize: '0.8em', color: '#888', lineHeight: 1.5 }}>{c.summary}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ReportCard({ report, onRegenerate, loading, weekKey }) {
  const [collapsed, setCollapsed] = useState(false)
  if (loading) return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: '1.1em' }}>📊</span>
        <span style={{ fontWeight: 700, fontSize: '0.9em' }}>Report settimanale</span>
      </div>
      <TypingIndicator label="Il Coach sta analizzando i tuoi dati..." />
    </div>
  )
  if (!report) return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88em' }}>Report settimanale</div>
          <div style={{ fontSize: '0.72em', color: '#555' }}>Non ancora generato questa settimana</div>
        </div>
      </div>
      <button onClick={onRegenerate} className="btn-main" style={{ fontSize: '0.82em', padding: '9px 14px' }}>Genera report settimanale</button>
    </div>
  )
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 10 }}>
        <span>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88em' }}>Report {weekKey}</div>
          <div style={{ fontSize: '0.72em', color: '#555' }}>{report.weekStart} — {report.weekEnd}</div>
        </div>
        <button onClick={() => setCollapsed(v => !v)} style={{ ...chipStyle, padding: '3px 8px' }}>{collapsed ? '▼' : '▲'}</button>
        {onRegenerate && <button onClick={onRegenerate} style={{ ...chipStyle, padding: '3px 8px', opacity: 0.7 }}>↻</button>}
      </div>
      {!collapsed && <div style={{ fontSize: '0.84em', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content) }} />}
    </div>
  )
}

function MessageBubble({ msg, avatar }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: isUser ? 'rgba(255,202,40,0.15)' : 'var(--theme-glow)', border: `1px solid ${isUser ? 'rgba(255,202,40,0.3)' : 'var(--theme-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85em' }}>
        {isUser ? (avatar || '🧑') : '🤖'}
      </div>
      <div style={{ maxWidth: '78%' }}>
        <div style={{ background: isUser ? 'rgba(255,202,40,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isUser ? 'rgba(255,202,40,0.15)' : 'rgba(255,255,255,0.1)'}`, borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '9px 13px', fontSize: '0.87em', lineHeight: 1.55 }}>
          {isUser
            ? <span style={{ color: 'var(--text)' }}>{msg.content}</span>
            : <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          }
        </div>
        {!isUser && msg.usage && (
          <div style={{ fontSize: '0.65em', color: '#444', marginTop: 4, textAlign: 'right' }}>
            claude-haiku-4-5 · {(msg.usage.totalTokens || 0).toLocaleString()} token · ${(msg.usage.costUSD || 0).toFixed(4)}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--theme-color)', animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      {label && <span style={{ fontSize: '0.78em', color: '#555' }}>{label}</span>}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chipStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20, padding: '5px 12px', fontSize: '0.75em', color: '#aaa',
  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
}
const cardStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '12px 14px', marginBottom: 12,
}
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: '0.88em',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
