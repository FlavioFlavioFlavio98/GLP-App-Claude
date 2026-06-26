import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../lib/store'

function highlight(text, query) {
  if (!text || !query) return text || ''
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '|||$1|||')
}

function HighlightedText({ text, query }) {
  const parts = highlight(text, query).split('|||')
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: 'rgba(255,202,40,0.35)', color: 'var(--text)', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

function excerpt(text, query, maxLen = 120) {
  if (!text || !query) return (text || '').slice(0, maxLen)
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function normalizeSessions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return Object.values(raw).filter(s => !s.deleted)
}

// Props: onClose, onOpenSession(id, data), onOpenProfile
export default function PsychSearchPage({ onClose, onOpenSession, onOpenProfile }) {
  const { state } = useApp()
  const { allUsersData } = state
  const userData = allUsersData?.flavio || {}

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null = not searched yet
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults(null); return }
    const lower = q.toLowerCase()
    const sessionResults = []
    const profileResults = []

    // Search sessions
    const sessions = normalizeSessions(userData?.psychSessions)
    sessions.forEach(sess => {
      const msgs = sess.messages || []
      msgs.forEach((msg, mi) => {
        const content = msg.content || ''
        if (content.toLowerCase().includes(lower)) {
          sessionResults.push({
            sessionId: sess.id,
            sessionData: sess,
            sessionTitle: sess.title || 'Sessione senza titolo',
            sessionDate: sess.updatedAt || sess.createdAt || '',
            role: msg.role,
            msgIndex: mi,
            excerpt: excerpt(content, q),
            content,
          })
        }
      })
    })

    // Search profile entries
    const entries = userData?.psychProfile?.dailyEntries || {}
    Object.entries(entries).forEach(([date, entry]) => {
      const fields = [
        { key: 'insights', label: 'Insights', val: entry.insights },
        { key: 'patterns', label: 'Pattern', val: entry.patterns },
        { key: 'openQuestions', label: 'Domande aperte', val: entry.openQuestions },
      ]
      fields.forEach(f => {
        const text = typeof f.val === 'string' ? f.val : ''
        if (text && text.toLowerCase().includes(lower)) {
          profileResults.push({ date, section: f.label, excerpt: excerpt(text, q), content: text })
        }
      })
      ;(entry.pinnedMoments || []).forEach((pm, pi) => {
        const text = pm.text || ''
        if (text.toLowerCase().includes(lower)) {
          profileResults.push({ date, section: '📌 Momento', excerpt: excerpt(text, q), content: text, pinnedIndex: pi })
        }
      })
    })

    setResults({ sessionResults, profileResults, total: sessionResults.length + profileResults.length })
  }, [userData])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timerRef.current)
  }, [query, doSearch])

  function fmtDate(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg)', zIndex: 10200, display: 'flex', flexDirection: 'column' }}>

      {/* Header + search input */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.4em', cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '1em', pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca in sessioni e profilo..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 36px 9px 34px', color: 'var(--text)', fontSize: '0.9em', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1em', padding: '2px 4px' }}>✕</button>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
        {!query.trim() && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#444' }}>
            <div style={{ fontSize: '2em', marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: '0.85em' }}>Cerca in sessioni e profilo psicologico</div>
          </div>
        )}

        {query.trim() && results === null && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#444', fontSize: '0.85em' }}>Ricerca...</div>
        )}

        {results && results.total === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#444' }}>
            <div style={{ fontSize: '1.5em', marginBottom: 8 }}>😶</div>
            <div style={{ fontSize: '0.85em' }}>Nessun risultato per "{query}"</div>
          </div>
        )}

        {results && results.sessionResults.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.7em', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              💬 Sessioni ({results.sessionResults.length})
            </div>
            {results.sessionResults.map((r, i) => (
              <button key={i} onClick={() => onOpenSession && onOpenSession(r.sessionId, r.sessionData)}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px', marginBottom: 6, textAlign: 'left', cursor: 'pointer', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75em', fontWeight: 700, color: 'var(--theme-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.sessionTitle}</span>
                  <span style={{ fontSize: '0.65em', color: '#555', flexShrink: 0 }}>{fmtDate(r.sessionDate)}</span>
                </div>
                <div style={{ fontSize: '0.72em', color: '#777', marginBottom: 4 }}>
                  {r.role === 'user' ? '🧍 Flavio' : '🧠 Psicologo'}
                </div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-sec)', lineHeight: 1.4 }}>
                  <HighlightedText text={r.excerpt} query={query} />
                </div>
              </button>
            ))}
          </div>
        )}

        {results && results.profileResults.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7em', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              📓 Profilo ({results.profileResults.length})
            </div>
            {results.profileResults.map((r, i) => (
              <button key={i} onClick={() => onOpenProfile && onOpenProfile(r.date)}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px', marginBottom: 6, textAlign: 'left', cursor: 'pointer', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75em', fontWeight: 700, color: 'var(--theme-color)' }}>{r.date}</span>
                  <span style={{ fontSize: '0.68em', color: '#666' }}>· {r.section}</span>
                </div>
                <div style={{ fontSize: '0.78em', color: 'var(--text-sec)', lineHeight: 1.4 }}>
                  <HighlightedText text={r.excerpt} query={query} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
