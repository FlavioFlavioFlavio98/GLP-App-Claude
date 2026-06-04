import { useState, useEffect, useRef } from 'react'
import { useApp } from '../lib/store'
import { useCoach } from '../hooks/useCoach'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { toDateString } from '../lib/habitLogic'

const QUICK_QUESTIONS = [
  'Come sto andando questa settimana?',
  'Qual è la mia abitudine più debole?',
  'Cosa dovrei migliorare?',
  'Analizza il mio equilibrio tra categorie',
  'Come influisce il mio mood sulle abitudini?',
  'Sono sulla strada giusta per i miei obiettivi?',
  'Dimmi qualcosa che non so di me stesso',
]

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

export default function CoachPage() {
  const { state, actions } = useApp()
  const { modal, authUserId, allUsersData } = state

  const userData = allUsersData?.flavio
  const dailyLogs = userData?.dailyLogs || {}
  const tags = userData?.tags || []
  const avatar = userData?.profile?.avatar || '🧑'

  const { sendMessage, generateWeeklyReport } = useCoach(userData, dailyLogs, tags)

  const weekKey = getWeekKey()
  const chatStorageKey = `glp_coach_chat_flavio`
  const reportStorageKey = `glp_coach_report_${weekKey}`

  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(chatStorageKey) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(reportStorageKey) || 'null') } catch { return null }
  })
  const [reportLoading, setReportLoading] = useState(false)
  const [showPastReports, setShowPastReports] = useState(false)
  const [pastReports, setPastReports] = useState([])
  const [pastReportsLoading, setPastReportsLoading] = useState(false)
  const [selectedPastReport, setSelectedPastReport] = useState(null)
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const autoGenerateRef = useRef(false)

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(chatStorageKey, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-generate if opened with autoGenerate payload
  useEffect(() => {
    if (modal === 'coach' && state.modalPayload?.autoGenerate && !report && !reportLoading && !autoGenerateRef.current) {
      autoGenerateRef.current = true
      handleGenerateReport()
    }
  }, [modal])

  if (modal !== 'coach') return null
  if (authUserId !== 'flavio') return null

  async function handleSend(text) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')
    setError(null)

    const newMessages = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      console.log('[CoachPage] handleSend — currentUser:', auth.currentUser?.email)
      const reply = await sendMessage(newMessages.map(m => ({ role: m.role, content: m.content })))
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      console.error('[CoachPage] sendMessage FULL ERROR:', {
        code: e.code, message: e.message, details: e.details,
        name: e.name, stack: e.stack?.slice(0, 300),
      })
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

      // Save to localStorage
      localStorage.setItem(reportStorageKey, JSON.stringify(newReport))
      setReport(newReport)

      // Save to Firestore
      try {
        await setDoc(
          doc(db, 'users', 'flavio'),
          { coachReports: { [weekKey]: { ...newReport, generatedAt: Timestamp.fromMillis(newReport.generatedAt) } } },
          { merge: true }
        )
      } catch (e) { console.warn('[CoachPage] Firestore save failed:', e) }
    } catch (e) {
      console.error('[CoachPage] generateWeeklyReport FULL ERROR:', {
        code: e.code, message: e.message, details: e.details,
        name: e.name, stack: e.stack?.slice(0, 300),
      })
      setError(`Errore: ${e.code || e.message || 'sconosciuto'}`)
    } finally {
      setReportLoading(false)
    }
  }

  async function handleLoadPastReports() {
    setShowPastReports(true)
    setPastReportsLoading(true)
    try {
      const snap = await getDoc(doc(db, 'users', 'flavio'))
      const reports = snap.data()?.coachReports || {}
      const list = Object.entries(reports)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, val]) => ({
          key,
          content: val.content,
          weekStart: val.weekStart,
          weekEnd: val.weekEnd,
          generatedAt: val.generatedAt?.toMillis ? val.generatedAt.toMillis() : val.generatedAt,
        }))
      setPastReports(list)
    } catch (e) {
      console.error('[CoachPage] load past reports error:', e)
    } finally {
      setPastReportsLoading(false)
    }
  }

  function handleNewChat() {
    if (!window.confirm('Iniziare una nuova conversazione? La cronologia attuale sarà cancellata.')) return
    setMessages([])
    localStorage.removeItem(chatStorageKey)
  }

  const reportPreview = report?.content?.split('\n').slice(0, 2).join(' ').slice(0, 120)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--card-solid)',
      }}>
        <span style={{ fontSize: '1.6em' }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05em' }}>Il tuo Coach</div>
          <div style={{ fontSize: '0.7em', color: '#555' }}>Powered by Claude AI</div>
        </div>
        <button
          onClick={() => setShowPastReports(false) || setSelectedPastReport(null) || actions.closeModal()}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: '1em' }}
        >✕</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>

        {/* Past reports view */}
        {showPastReports && !selectedPastReport && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setShowPastReports(false)} style={chipStyle}>← Torna alla chat</button>
              <span style={{ fontWeight: 700 }}>Report precedenti</span>
            </div>
            {pastReportsLoading && <TypingIndicator />}
            {!pastReportsLoading && pastReports.length === 0 && (
              <div style={{ color: '#555', fontSize: '0.85em', textAlign: 'center', marginTop: 40 }}>Nessun report salvato</div>
            )}
            {pastReports.map(r => (
              <div key={r.key}
                onClick={() => setSelectedPastReport(r)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: 4 }}>{r.key} — {r.weekStart} / {r.weekEnd}</div>
                <div style={{ fontSize: '0.78em', color: '#666' }}>{r.content?.slice(0, 100)}…</div>
              </div>
            ))}
          </div>
        )}

        {/* Single past report */}
        {selectedPastReport && (
          <div>
            <button onClick={() => setSelectedPastReport(null)} style={{ ...chipStyle, marginBottom: 16 }}>← Lista report</button>
            <ReportCard report={selectedPastReport} onRegenerate={null} loading={false} />
          </div>
        )}

        {/* Main view */}
        {!showPastReports && !selectedPastReport && (
          <>
            {/* Weekly report card */}
            <ReportCard
              report={report}
              onRegenerate={handleGenerateReport}
              loading={reportLoading}
              weekKey={weekKey}
            />

            {/* Error banner */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82em', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Chat messages */}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#444', fontSize: '0.85em' }}>
                <div style={{ fontSize: '2em', marginBottom: 8 }}>🤖</div>
                Fai una domanda al Coach o usa uno dei suggerimenti sotto.
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} avatar={avatar} />
            ))}

            {loading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Bottom area: quick questions + input */}
      {!showPastReports && !selectedPastReport && (
        <div style={{ padding: '10px 16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--card-solid)' }}>
          {/* Quick question chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => handleSend(q)} style={chipStyle} disabled={loading}>
                {q}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Chiedi qualcosa al Coach..."
              rows={1}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: '0.9em',
                resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)',
                color: input.trim() && !loading ? '#000' : '#444',
                border: 'none', borderRadius: 12, padding: '10px 16px',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontWeight: 700, fontSize: '0.9em', transition: 'all 0.15s',
              }}
            >↑</button>
          </div>

          {/* Bottom actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleNewChat} style={{ ...chipStyle, opacity: 0.6 }}>
              🔄 Nuova conversazione
            </button>
            <button onClick={handleLoadPastReports} style={{ ...chipStyle, opacity: 0.6 }}>
              📋 Report precedenti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportCard({ report, onRegenerate, loading, weekKey }) {
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '1.2em' }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: '0.9em' }}>Report settimanale</span>
        </div>
        <TypingIndicator label="Il Coach sta analizzando i tuoi dati..." />
      </div>
    )
  }

  if (!report) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '1.2em' }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9em' }}>Report settimanale</div>
            <div style={{ fontSize: '0.73em', color: '#555' }}>Non ancora generato questa settimana</div>
          </div>
        </div>
        <button onClick={onRegenerate} className="btn-main" style={{ fontSize: '0.85em', padding: '10px 16px' }}>
          Genera report settimanale
        </button>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 12 }}>
        <span style={{ fontSize: '1.2em' }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9em' }}>Report {weekKey}</div>
          <div style={{ fontSize: '0.73em', color: '#555' }}>
            {report.weekStart} — {report.weekEnd}
          </div>
        </div>
        <button onClick={() => setCollapsed(v => !v)} style={{ ...chipStyle, padding: '4px 8px' }}>
          {collapsed ? '▼' : '▲'}
        </button>
        {onRegenerate && (
          <button onClick={onRegenerate} style={{ ...chipStyle, padding: '4px 8px', opacity: 0.7 }}>
            Rigenera
          </button>
        )}
      </div>
      {!collapsed && (
        <div
          style={{ fontSize: '0.85em', lineHeight: 1.6, color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content) }}
        />
      )}
    </div>
  )
}

function MessageBubble({ msg, avatar }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'rgba(255,202,40,0.15)' : 'var(--theme-glow)',
        border: `1px solid ${isUser ? 'rgba(255,202,40,0.3)' : 'var(--theme-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1em',
      }}>
        {isUser ? avatar : '🤖'}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '78%',
        background: isUser ? 'rgba(255,202,40,0.08)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isUser ? 'rgba(255,202,40,0.15)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '10px 14px',
        fontSize: '0.88em', lineHeight: 1.6,
      }}>
        {isUser
          ? <span style={{ color: 'var(--text)' }}>{msg.content}</span>
          : <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        }
      </div>
    </div>
  )
}

function TypingIndicator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--theme-color)',
            animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      {label && <span style={{ fontSize: '0.78em', color: '#555' }}>{label}</span>}
    </div>
  )
}

const chipStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
  padding: '5px 12px',
  fontSize: '0.75em',
  color: '#aaa',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding: '14px 16px',
  marginBottom: 16,
}
