import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import PsychPage from './PsychPage'
import PsychProfilePage from './PsychProfilePage'
import PsychStatsDrawer from './PsychStatsDrawer'
import PsychSearchPage from './PsychSearchPage'
import { exportSessionPdf } from '../lib/psychPdf'

function fmtRelDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = toDateString(new Date())
  const ds = toDateString(d)
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (ds === today) return 'Oggi'
  if (ds === yesterday) return 'Ieri'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function modelShort(m) {
  if (!m) return ''
  if (m.includes('flash-lite')) return 'Flash-Lite'
  if (m.includes('flash')) return 'Flash'
  if (m.includes('pro')) return 'Pro'
  if (m.includes('3.5')) return '3.5 Flash'
  return m.split('-').slice(-1)[0]
}

// Normalize sessions: support both old array format and new map format
function normalizeSessions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    // Old format — convert to pseudo-sessions (no messages stored)
    return raw.map(s => ({
      id: s.id || `sess_${s.date}`,
      title: `Sessione ${s.date || ''}`,
      createdAt: s.date ? s.date + 'T00:00:00.000Z' : null,
      updatedAt: s.date ? s.date + 'T00:00:00.000Z' : null,
      model: s.model,
      messages: [],
      messageCount: s.messageCount || 0,
      totalTokens: s.totalTokens || 0,
      totalCostEUR: s.totalCostEUR || 0,
      profileEntryGenerated: false,
      legacy: true,
    }))
  }
  // New map format
  return Object.values(raw).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export default function PsychSessionsPage({ onClose }) {
  const { state, actions } = useApp()
  const { allUsersData } = state
  const userData = allUsersData?.flavio || {}
  const ps = userData?.psychStats || {}

  const [activeSession, setActiveSession] = useState(null) // { id, data } | null
  const [showProfile, setShowProfile] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [longPressMenu, setLongPressMenu] = useState(null) // { id, x, y }
  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')

  const rawSessions = userData?.psychSessions
  const sessions = normalizeSessions(rawSessions)

  // ── Create new session ─────────────────────────────────────────────────────
  async function handleNewSession() {
    const id = `sess_${Date.now()}`
    const now = new Date().toISOString()
    const session = {
      id,
      title: 'Nuova sessione',
      createdAt: now,
      updatedAt: now,
      model: 'gemini-2.5-flash-lite',
      messages: [],
      messageCount: 0,
      totalTokens: 0,
      totalCostEUR: 0,
      profileEntryGenerated: false,
    }
    try {
      await updateDoc(doc(db, 'users', 'flavio'), {
        [`psychSessions.${id}`]: session,
      })
    } catch (e) { console.warn('[Sessions] create failed:', e) }
    setActiveSession({ id, data: session })
  }

  // ── Rename session ─────────────────────────────────────────────────────────
  async function handleRename(id) {
    const title = renameText.trim()
    if (!title) { setRenamingId(null); return }
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`psychSessions.${id}.title`]: title,
    })
    setRenamingId(null)
    actions.showToast('Sessione rinominata', '✓')
  }

  // ── Delete session ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('Eliminare questa sessione?')) return
    setLongPressMenu(null)
    // Remove by setting to null — Firestore doesn't allow delete of map key directly,
    // so we mark it deleted; the list filters it out
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`psychSessions.${id}.deleted`]: true,
    })
    actions.showToast('Sessione eliminata', '🗑️')
  }

  // Long press
  let longPressTimer = null
  function onTouchStart(e, id) {
    const touch = e.touches[0]
    longPressTimer = setTimeout(() => {
      setLongPressMenu({ id, x: touch.clientX, y: touch.clientY })
      if (navigator.vibrate) navigator.vibrate(40)
    }, 500)
  }
  function onTouchEnd() { clearTimeout(longPressTimer) }

  const visibleSessions = sessions.filter(s => !s.deleted)

  // ── Sub-pages ──────────────────────────────────────────────────────────────
  if (showSearch) {
    return <PsychSearchPage
      onClose={() => setShowSearch(false)}
      onOpenSession={(id, data) => { setShowSearch(false); setActiveSession({ id, data }) }}
      onOpenProfile={() => { setShowSearch(false); setShowProfile(true) }}
    />
  }

  if (showProfile) {
    return (
      <PsychProfilePage
        psychProfile={userData?.psychProfile}
        psychSessions={visibleSessions}
        psychStats={ps}
        onClose={() => setShowProfile(false)}
        authUserId="flavio"
      />
    )
  }

  if (activeSession) {
    return (
      <PsychPage
        sessionId={activeSession.id}
        sessionData={activeSession.data}
        onBack={() => setActiveSession(null)}
        onClose={onClose}
        onOpenProfile={() => setShowProfile(true)}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05em' }}>🧠 Psicologo AI</div>
            <div style={{ fontSize: '0.72em', color: 'var(--text-sec)' }}>Spazio personale di Flavio</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSearch(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '0.95em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔍</button>
          <button onClick={() => setShowStats(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '0.95em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📊</button>
          <button onClick={() => setShowProfile(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</button>
        </div>
      </div>

      {/* New session button */}
      <div style={{ padding: '12px 16px', flexShrink: 0 }}>
        <button onClick={handleNewSession}
          style={{ width: '100%', background: 'var(--theme-color)', border: 'none', borderRadius: 14, padding: '13px', color: '#000', fontWeight: 700, fontSize: '0.95em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1em' }}>+</span> Nuova sessione
        </button>
      </div>

      {/* Sessions list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
        {visibleSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#444', fontSize: '0.9em' }}>
            <div style={{ fontSize: '2.5em', marginBottom: 12 }}>💬</div>
            <div>Nessuna sessione ancora</div>
            <div style={{ fontSize: '0.85em', marginTop: 6, color: '#3a3a3a' }}>Crea la tua prima sessione</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.7em', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Sessioni recenti
            </div>
            {visibleSessions.map(sess => (
              <div key={sess.id}
                onTouchStart={e => onTouchStart(e, sess.id)}
                onTouchEnd={onTouchEnd}
                onTouchMove={onTouchEnd}
              >
                {renamingId === sess.id ? (
                  <div style={{ background: 'var(--card)', border: '1px solid var(--theme-color)', borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
                    <input
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(sess.id); if (e.key === 'Escape') setRenamingId(null) }}
                      autoFocus
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: '0.88em', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => setRenamingId(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '7px', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.8em' }}>Annulla</button>
                      <button onClick={() => handleRename(sess.id)} style={{ flex: 2, background: 'var(--theme-color)', border: 'none', borderRadius: 8, padding: '7px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.8em' }}>Salva</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveSession({ id: sess.id, data: sess })}
                    style={{ width: '100%', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.2em', flexShrink: 0 }}>📝</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88em', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sess.title || 'Sessione senza titolo'}
                        {sess.profileEntryGenerated && <span style={{ marginLeft: 6, fontSize: '0.75em', color: 'var(--theme-color)' }}>📓</span>}
                      </div>
                      <div style={{ fontSize: '0.72em', color: 'var(--text-sec)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span>{fmtRelDate(sess.updatedAt || sess.createdAt)}</span>
                        {sess.messageCount > 0 && <span>· {sess.messageCount} msg</span>}
                        {sess.model && <span>· {modelShort(sess.model)}</span>}
                        {sess.totalCostEUR > 0 && <span>· €{sess.totalCostEUR.toFixed(4)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                      <span style={{ color: '#444', fontSize: '0.9em' }}>→</span>
                      {(sess.messages || []).length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); exportSessionPdf({ session: sess, psychProfile: userData?.psychProfile }) }}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 5px', color: '#555', cursor: 'pointer', fontSize: '0.62em' }}>
                          ⬇️
                        </button>
                      )}
                    </div>
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Long press menu */}
      {longPressMenu && (
        <>
          <div onClick={() => setLongPressMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 10400 }} />
          <div style={{ position: 'fixed', left: Math.min(longPressMenu.x, window.innerWidth - 160), top: longPressMenu.y, zIndex: 10401, background: 'var(--card)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', minWidth: 150 }}>
            <button onClick={() => { const s = visibleSessions.find(s => s.id === longPressMenu.id); setRenameText(s?.title || ''); setRenamingId(longPressMenu.id); setLongPressMenu(null) }}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', fontSize: '0.88em' }}>
              ✏️ Rinomina
            </button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <button onClick={() => handleDelete(longPressMenu.id)}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', textAlign: 'left', fontSize: '0.88em' }}>
              🗑️ Elimina
            </button>
          </div>
        </>
      )}

      {showStats && (
        <PsychStatsDrawer
          onClose={() => setShowStats(false)}
          psychStats={ps}
          psychSessions={visibleSessions}
          psychProfile={userData?.psychProfile}
          todayWords={0}
          todayTimeSeconds={0}
          todayActiveSeconds={0}
        />
      )}
    </div>
  )
}
