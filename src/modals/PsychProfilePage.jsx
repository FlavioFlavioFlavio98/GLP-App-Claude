import { useState, useRef, useCallback } from 'react'
import PsychSearchPage from './PsychSearchPage'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { buildPsychSystemPrompt } from '../lib/psychPrompt'
import { buildGlpContext } from '../lib/psychContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'

// ── helpers ───────────────────────────────────────────────────────────────────

// Cleans up malformed field values that arrive as JSON strings or objects
function safeText(val) {
  if (val === null || val === undefined || val === 'null') return null
  if (typeof val === 'object') {
    // object accidentally stored — try to extract insights field or stringify
    const s = val.insights || val.text || val.narrative || val.content
    if (s && typeof s === 'string') return safeText(s)
    return JSON.stringify(val)
  }
  let s = String(val).trim()
  // Strip markdown code fences: ```json\n...\n``` or ```\n...\n```
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
  // If still looks like a JSON object, try to parse and extract text
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s)
      const candidate = parsed.insights || parsed.text || parsed.narrative || parsed.content || parsed.patterns || parsed.openQuestions
      if (candidate && typeof candidate === 'string') return candidate.trim()
      // If no obvious text field, return all string values joined
      const strVals = Object.values(parsed).filter(v => typeof v === 'string').join('\n')
      if (strVals) return strVals
    } catch { /* not parseable — show as-is */ }
  }
  return s || null
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dMidnight = new Date(d); dMidnight.setHours(12, 0, 0, 0)
  if (dMidnight.getTime() === today.getTime()) return 'Oggi'
  if (dMidnight.getTime() === yesterday.getTime()) return 'Ieri'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function monthKey(dateStr) {
  return dateStr?.slice(0, 7) || ''
}

function fmtMonth(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

function ChipList({ items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {items.map((item, i) => {
        const label = typeof item === 'string' ? item : (item?.name || item?.text || JSON.stringify(item))
        return (
          <span key={i} style={{ background: color || 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 10px', fontSize: '0.75em', color: 'var(--text-sec)' }}>{label}</span>
        )
      })}
    </div>
  )
}

// ── WhatKnowsModal ────────────────────────────────────────────────────────────
function WhatKnowsModal({ psychProfile, userData, dailyLogs, onClose }) {
  const systemPrompt = buildPsychSystemPrompt(psychProfile, buildGlpContext(userData, dailyLogs))
  const estimatedTokens = Math.round(systemPrompt.length / 4)
  const costEUR = ((estimatedTokens / 1_000_000) * 0.10 * 0.92).toFixed(5)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10200, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05em' }}>👁️ Cosa sa di me</div>
          <div style={{ fontSize: '0.72em', color: 'var(--text-sec)' }}>System prompt passato all'AI ogni sessione</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 12 }}>
          Token stimati: ~{estimatedTokens.toLocaleString()} · Costo stimato per sessione: €{costEUR}
        </div>
        <textarea
          readOnly
          value={systemPrompt}
          style={{ width: '100%', minHeight: 400, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: '0.78em', lineHeight: 1.6, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  )
}

// ── CorrectionDrawer ──────────────────────────────────────────────────────────
function CorrectionDrawer({ entryDate, currentEntry, onClose, onSave }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const fns = getFunctions(getApp(), 'europe-west1')
  const correctFn = httpsCallable(fns, 'correctDailyEntry', { timeout: 60000 })

  async function handleSend() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const r = await correctFn({ entryDate, currentEntry, correction: text.trim() })
      setResult(r.data.correctedEntry)
    } catch (e) {
      alert('Errore: ' + (e.message || 'Riprova'))
    } finally { setLoading(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10300 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10301, background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '20px 16px max(24px, env(safe-area-inset-bottom, 24px))', boxShadow: '0 -4px 32px rgba(0,0,0,0.4)', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.95em' }}>🔧 Correggi entry — {fmtDate(entryDate)}</div>

        {!result ? (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder='In realtà era così... / Non è corretto che... / Aggiungi che...'
              rows={4}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: '0.88em', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.85em' }}>Annulla</button>
              <button onClick={handleSend} disabled={!text.trim() || loading}
                style={{ flex: 2, background: !text.trim() || loading ? 'rgba(255,255,255,0.06)' : 'var(--theme-color)', border: 'none', borderRadius: 10, padding: '10px', color: !text.trim() || loading ? '#555' : '#000', cursor: !text.trim() || loading ? 'default' : 'pointer', fontSize: '0.85em', fontWeight: 700 }}>
                {loading ? '🤔 Elaborazione...' : 'Invia correzione'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: 'rgba(57,193,118,0.08)', border: '1px solid rgba(57,193,118,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: '0.72em', color: 'var(--success)', fontWeight: 700, marginBottom: 6 }}>✅ Ecco cosa ho cambiato:</div>
              <div style={{ fontSize: '0.83em', color: 'var(--text)', lineHeight: 1.5, fontStyle: 'italic' }}>"{result.changesSummary}"</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.85em' }}>✗ Annulla</button>
              <button onClick={() => onSave(result)} style={{ flex: 2, background: 'var(--theme-color)', border: 'none', borderRadius: 10, padding: '10px', color: '#000', cursor: 'pointer', fontSize: '0.85em', fontWeight: 700 }}>✓ Salva</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── DailyEntry ────────────────────────────────────────────────────────────────
function DailyEntry({ dateStr, entry, onUpdate, onCorrectSave, scrollRef }) {
  const [editing, setEditing] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [editForm, setEditForm] = useState({})
  const { actions } = useApp()

  const isToday = dateStr === toDateString(new Date())
  const starred = entry.starred || false

  async function toggleStar() {
    const updates = { [`psychProfile.dailyEntries.${dateStr}.starred`]: !starred }
    await updateDoc(doc(db, 'users', 'flavio'), updates)
    onUpdate(dateStr, { ...entry, starred: !starred })
    actions.showToast(starred ? 'Entry rimosso dai fondamentali' : '⭐ Entry marcato come fondamentale', starred ? '✓' : '⭐')
  }

  async function saveEdit() {
    const now = new Date().toISOString()
    const updates = {
      [`psychProfile.dailyEntries.${dateStr}.insights`]: editForm.insights || entry.insights,
      [`psychProfile.dailyEntries.${dateStr}.patterns`]: editForm.patterns !== undefined ? editForm.patterns : entry.patterns,
      [`psychProfile.dailyEntries.${dateStr}.openQuestions`]: editForm.openQuestions !== undefined ? editForm.openQuestions : entry.openQuestions,
      [`psychProfile.dailyEntries.${dateStr}.lastEdited`]: now,
    }
    await updateDoc(doc(db, 'users', 'flavio'), updates)
    onUpdate(dateStr, { ...entry, ...editForm, lastEdited: now })
    setEditing(false)
    actions.showToast('Entry aggiornato', '✓')
  }

  async function applyCorrection(correctedEntry) {
    const now = new Date().toISOString()
    const correction = {
      original: entry.insights,
      corrected: correctedEntry.updatedInsights,
      correctedAt: now,
    }
    const updates = {
      [`psychProfile.dailyEntries.${dateStr}.insights`]: correctedEntry.updatedInsights || entry.insights,
      [`psychProfile.dailyEntries.${dateStr}.patterns`]: correctedEntry.updatedPatterns || entry.patterns,
      [`psychProfile.dailyEntries.${dateStr}.openQuestions`]: correctedEntry.updatedOpenQuestions || entry.openQuestions,
      [`psychProfile.dailyEntries.${dateStr}.lastEdited`]: now,
    }
    await updateDoc(doc(db, 'users', 'flavio'), updates)
    // Append correction to history using arrayUnion
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`psychProfile.dailyEntries.${dateStr}.corrections`]: arrayUnion(correction),
    })
    onUpdate(dateStr, { ...entry, insights: correctedEntry.updatedInsights || entry.insights, patterns: correctedEntry.updatedPatterns || entry.patterns, openQuestions: correctedEntry.updatedOpenQuestions || entry.openQuestions, lastEdited: now })
    setCorrecting(false)
    actions.showToast('Correzione applicata', '✓')
  }

  return (
    <div
      id={`entry-${dateStr}`}
      style={{
        background: 'var(--card)',
        border: starred ? '1px solid var(--theme-color)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Entry header */}
      <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '0.82em', color: starred ? 'var(--theme-color)' : 'var(--text)', fontWeight: 600 }}>
          📅 {isToday ? 'Oggi — ' : ''}{fmtDate(dateStr)}
        </span>
        {entry.autoGenerated === false && (
          <span style={{ fontSize: '0.6em', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '2px 6px', color: '#555' }}>manuale</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={toggleStar} title={starred ? 'Rimuovi dai fondamentali' : 'Marca come fondamentale (sempre nel contesto AI)'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', opacity: starred ? 1 : 0.3, padding: '2px 4px', color: starred ? '#f5c518' : 'var(--text)' }}>
            ⭐
          </button>
          <button onClick={() => { setEditForm({ insights: safeText(entry.insights) || '', patterns: safeText(entry.patterns) || '', openQuestions: safeText(entry.openQuestions) || '' }); setEditing(true) }}
            title="Modifica" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85em', opacity: 0.5, padding: '2px 4px', color: 'var(--text)' }}>
            ✏️
          </button>
          <button onClick={() => setCorrecting(true)} title="Correggi con AI"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85em', opacity: 0.5, padding: '2px 4px', color: 'var(--text)' }}>
            🔧
          </button>
        </div>
      </div>

      {/* Entry body */}
      <div style={{ padding: '12px 14px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4 }}>🧠 INSIGHTS</div>
              <textarea value={editForm.insights || ''} onChange={e => setEditForm(p => ({ ...p, insights: e.target.value }))} rows={5} style={textAreaStyle} />
            </div>
            <div>
              <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4 }}>⚠️ PATTERN</div>
              <textarea value={editForm.patterns || ''} onChange={e => setEditForm(p => ({ ...p, patterns: e.target.value }))} rows={3} placeholder="(vuoto se nessuno)" style={textAreaStyle} />
            </div>
            <div>
              <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4 }}>💡 DOMANDE APERTE</div>
              <textarea value={editForm.openQuestions || ''} onChange={e => setEditForm(p => ({ ...p, openQuestions: e.target.value }))} rows={3} placeholder="(vuoto se nessuno)" style={textAreaStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.82em' }}>Annulla</button>
              <button onClick={saveEdit} style={{ flex: 2, background: 'var(--theme-color)', border: 'none', borderRadius: 10, padding: '8px', color: '#000', cursor: 'pointer', fontSize: '0.82em', fontWeight: 700 }}>Salva modifiche</button>
            </div>
          </div>
        ) : (
          <>
            <EntryBlock icon="🧠" label="Insights" text={entry.insights} />
            <EntryBlock icon="⚠️" label="Pattern emersi" text={entry.patterns} />
            <EntryBlock icon="💡" label="Domande aperte" text={entry.openQuestions} />
            {entry.connections?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>🔗 Connessioni</div>
                {entry.connections.map((c, i) => (
                  <div key={i} style={{ fontSize: '0.78em', color: 'var(--text-sec)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                    <a href={`#entry-${c.date}`} onClick={e => { e.preventDefault(); document.getElementById(`entry-${c.date}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                      style={{ color: 'var(--theme-color)', textDecoration: 'none', fontWeight: 600 }}>{c.date}</a>
                    {' — '}{c.note}
                  </div>
                ))}
              </div>
            )}
            {entry.pinnedMoments?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>📌 Momenti salvati</div>
                {entry.pinnedMoments.map((m, i) => (
                  <div key={i} style={{ fontSize: '0.78em', color: 'var(--text-sec)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid var(--theme-color)', fontStyle: 'italic' }}>
                    "{typeof m === 'string' ? m : m.text}"
                  </div>
                ))}
              </div>
            )}
            {entry.lastEdited && (
              <div style={{ fontSize: '0.62em', color: '#3a3a3a', marginTop: 8 }}>
                Modificato: {new Date(entry.lastEdited).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </>
        )}
      </div>

      {correcting && (
        <CorrectionDrawer
          entryDate={dateStr}
          currentEntry={entry}
          onClose={() => setCorrecting(false)}
          onSave={applyCorrection}
        />
      )}
    </div>
  )
}

const textAreaStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontSize: '0.85em', resize: 'vertical',
  fontFamily: 'inherit', lineHeight: 1.5, outline: 'none', boxSizing: 'border-box',
}

function EntryBlock({ icon, label, text }) {
  const clean = safeText(text)
  if (!clean) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 3 }}>{icon} {label.toUpperCase()}</div>
      <div style={{ fontSize: '0.85em', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{clean}</div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PsychProfilePage({ psychProfile, psychSessions, psychStats, onClose, authUserId }) {
  const { actions, state } = useApp()
  const { allUsersData } = state
  const userData = allUsersData?.flavio || {}
  const dailyLogs = userData?.dailyLogs || {}

  const [localProfile, setLocalProfile] = useState(psychProfile || {})
  const [globalExpanded, setGlobalExpanded] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState(new Set())
  const [showWhatKnows, setShowWhatKnows] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [addingManual, setAddingManual] = useState(false)
  const [manualForm, setManualForm] = useState({ date: toDateString(new Date()), text: '' })

  const globalSummary = localProfile?.globalSummary || null
  const dailyEntries = localProfile?.dailyEntries || {}
  const hasOldFormat = !localProfile?.globalSummary && !localProfile?.dailyEntries && localProfile?.narrative

  function handleUpdate(dateStr, updatedEntry) {
    setLocalProfile(prev => ({
      ...prev,
      dailyEntries: { ...(prev.dailyEntries || {}), [dateStr]: updatedEntry },
    }))
  }

  // Group entries by month, sorted newest first
  const sortedDates = Object.keys(dailyEntries).sort((a, b) => b.localeCompare(a))
  const currentMonth = toDateString(new Date()).slice(0, 7)

  const grouped = {}
  sortedDates.forEach(d => {
    const mk = monthKey(d)
    if (!grouped[mk]) grouped[mk] = []
    grouped[mk].push(d)
  })
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function toggleMonth(mk) {
    setExpandedMonths(prev => {
      const n = new Set(prev)
      n.has(mk) ? n.delete(mk) : n.add(mk)
      return n
    })
  }

  async function saveManualEntry() {
    if (!manualForm.text.trim()) return
    const dateStr = manualForm.date || toDateString(new Date())
    const entry = {
      id: dateStr,
      date: dateStr,
      autoGenerated: false,
      starred: false,
      insights: manualForm.text.trim(),
      patterns: null,
      openQuestions: null,
      connections: [],
      pinnedMoments: [],
    }
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`psychProfile.dailyEntries.${dateStr}`]: entry,
    })
    setLocalProfile(prev => ({
      ...prev,
      dailyEntries: { ...(prev.dailyEntries || {}), [dateStr]: entry },
    }))
    setAddingManual(false)
    setManualForm({ date: toDateString(new Date()), text: '' })
    actions.showToast('Nota manuale aggiunta', '✓')
  }

  async function handleReset() {
    if (!window.confirm('Sei sicuro? Questa azione elimina tutto il profilo psicologico accumulato.')) return
    if (!window.confirm('Conferma definitiva: eliminare il profilo psicologico?')) return
    await updateDoc(doc(db, 'users', 'flavio'), {
      psychProfile: {},
      psychSessions: [],
      psychStats: { totalTokensLifetime: 0, totalCostEURLifetime: 0, totalSessions: 0, totalMessages: 0 },
    })
    actions.showToast('Profilo psicologico resettato', '🗑️')
    onClose()
  }

  if (showWhatKnows) {
    return <WhatKnowsModal psychProfile={localProfile} userData={userData} dailyLogs={dailyLogs} onClose={() => setShowWhatKnows(false)} />
  }

  if (showSearch) {
    return <PsychSearchPage
      onClose={() => setShowSearch(false)}
      onOpenSession={() => setShowSearch(false)}
      onOpenProfile={(date) => { setShowSearch(false) }}
    />
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 10100, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05em' }}>Il tuo Profilo Psicologico</div>
          {globalSummary?.lastUpdated && (
            <div style={{ fontSize: '0.7em', color: 'var(--text-sec)' }}>
              Aggiornato: {new Date(globalSummary.lastUpdated).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowSearch(true)}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '0.95em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔍</button>
          <button onClick={() => setShowWhatKnows(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 12px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.75em' }}>
            👁️ Cosa sa di me
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 60px' }}>

        {/* Old format notice */}
        {hasOldFormat && (
          <div style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: '0.78em', color: '#d4a800' }}>
            ⚠️ Profilo nel vecchio formato — completa una nuova sessione per generare il diario psicologico aggiornato
          </div>
        )}

        {/* Section 1 — Global summary (collapsible) */}
        {(globalSummary || hasOldFormat) && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setGlobalExpanded(v => !v)}
              style={{ width: '100%', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <span style={{ opacity: 0.5 }}>{globalExpanded ? '▼' : '▶'}</span>
              <span style={{ fontWeight: 600, fontSize: '0.88em' }}>📖 Riassunto Globale</span>
              {globalSummary?.lastUpdated && (
                <span style={{ marginLeft: 'auto', fontSize: '0.68em', color: '#444' }}>
                  {new Date(globalSummary.lastUpdated).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </button>
            {globalExpanded && (
              <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px' }}>
                {safeText(globalSummary?.narrative || (hasOldFormat && localProfile?.narrative)) && (
                  <div style={{ fontSize: '0.87em', color: 'var(--text)', lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                    {safeText(globalSummary?.narrative || localProfile?.narrative)}
                  </div>
                )}
                {(globalSummary?.coreThemes || localProfile?.coreThemes)?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>🎯 TEMI RICORRENTI</div>
                    <ChipList items={globalSummary?.coreThemes || localProfile?.coreThemes} />
                  </div>
                )}
                {(globalSummary?.emotionalPatterns || localProfile?.emotionalPatterns)?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>💭 PATTERN EMOTIVI</div>
                    <ChipList items={globalSummary?.emotionalPatterns || localProfile?.emotionalPatterns} />
                  </div>
                )}
                {(globalSummary?.growthAreas || localProfile?.growthAreas)?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>🌱 AREE DI CRESCITA</div>
                    <ChipList items={globalSummary?.growthAreas || localProfile?.growthAreas} />
                  </div>
                )}
                {(globalSummary?.strengths || localProfile?.strengths)?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68em', color: '#555', fontWeight: 700, marginBottom: 4 }}>💪 PUNTI DI FORZA</div>
                    <ChipList items={globalSummary?.strengths || localProfile?.strengths} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 2 — Daily log */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.72em', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              📓 Log Cronologico — {sortedDates.length} entry
            </div>
            <button onClick={() => setAddingManual(v => !v)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 12px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.75em' }}>
              + Nota manuale
            </button>
          </div>

          {/* Manual entry form */}
          {addingManual && (
            <div style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px', marginBottom: 12 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4 }}>DATA</div>
                <input type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: '0.85em', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 4 }}>NOTA</div>
                <textarea value={manualForm.text} onChange={e => setManualForm(p => ({ ...p, text: e.target.value }))} rows={4} placeholder="Scrivi la tua nota..." style={textAreaStyle} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setAddingManual(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.82em' }}>Annulla</button>
                <button onClick={saveManualEntry} disabled={!manualForm.text.trim()} style={{ flex: 2, background: manualForm.text.trim() ? 'var(--theme-color)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: '8px', color: manualForm.text.trim() ? '#000' : '#555', cursor: manualForm.text.trim() ? 'pointer' : 'default', fontSize: '0.82em', fontWeight: 700 }}>Salva nota</button>
              </div>
            </div>
          )}

          {sortedDates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: '0.88em' }}>
              <div style={{ fontSize: '2em', marginBottom: 12 }}>📓</div>
              Completa una sessione e clicca "Nuova sessione" per generare il tuo primo entry
            </div>
          )}

          {/* Current month — always visible */}
          {grouped[currentMonth]?.map(dateStr => (
            <DailyEntry key={dateStr} dateStr={dateStr} entry={dailyEntries[dateStr]} onUpdate={handleUpdate} />
          ))}

          {/* Past months — accordion */}
          {sortedMonths.filter(mk => mk !== currentMonth).map(mk => {
            const isOpen = expandedMonths.has(mk)
            const count = grouped[mk].length
            return (
              <div key={mk} style={{ marginBottom: 8 }}>
                <button onClick={() => toggleMonth(mk)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: isOpen ? '12px 12px 0 0' : 12, padding: '10px 14px', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em' }}>
                  <span style={{ opacity: 0.5 }}>{isOpen ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 600 }}>{fmtMonth(mk)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: '#444' }}>{count} {count === 1 ? 'entry' : 'entry'}</span>
                </button>
                {isOpen && (
                  <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                    {grouped[mk].map(dateStr => (
                      <DailyEntry key={dateStr} dateStr={dateStr} entry={dailyEntries[dateStr]} onUpdate={handleUpdate} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sessions accordion */}
        {psychSessions?.length > 0 && (
          <div style={{ marginTop: 8, marginBottom: 24 }}>
            <button onClick={() => setExpandedMonths(prev => { const n = new Set(prev); n.has('_sess') ? n.delete('_sess') : n.add('_sess'); return n })}
              style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.82em', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {expandedMonths.has('_sess') ? '▲' : '▼'} 📋 Storico sessioni ({psychSessions.length})
            </button>
            {expandedMonths.has('_sess') && [...psychSessions].reverse().map(sess => (
              <div key={sess.id} style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78em', color: 'var(--theme-color)', fontWeight: 700 }}>{sess.date}</span>
                  <span style={{ fontSize: '0.7em', color: '#555' }}>{sess.model}</span>
                </div>
                <div style={{ fontSize: '0.75em', color: '#555' }}>{sess.messageCount} msg · {sess.totalTokens?.toLocaleString()} tok · €{sess.totalCostEUR?.toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reset */}
        <div style={{ paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleReset} style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: 10, padding: '10px 16px', color: '#e57373', cursor: 'pointer', fontSize: '0.85em', width: '100%' }}>
            🗑️ Resetta profilo psicologico
          </button>
        </div>
      </div>
    </div>
  )
}
