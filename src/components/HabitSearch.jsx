import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { isHabitVisible, toDateString } from '../lib/habitLogic'

export default function HabitSearch({ onClose }) {
  const { state, actions } = useApp()
  const { globalData } = state
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const today = toDateString(new Date())

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const tags = globalData?.tags || []
  const tagsMap = {}
  tags.forEach(t => { tagsMap[t.id] = t })

  const habits = (globalData?.habits || []).filter(h =>
    h.type !== 'goal' && !h.archivedAt &&
    (
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      (tagsMap[h.tagId]?.name || '').toLowerCase().includes(query.toLowerCase())
    )
  )

  const results = query.trim().length > 0 ? habits : []

  function isToday(h) {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const entry = globalData?.dailyLogs?.[today]
    const doneToday = Array.isArray(entry) ? entry : (entry?.habits || [])
    const failedToday = Array.isArray(entry) ? [] : (entry?.failedHabits || [])
    return isHabitVisible(h, today, doneToday, failedToday)
  }

  function getLastDone(h) {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const dates = Object.keys(globalData?.dailyLogs || {}).sort().reverse()
    for (const d of dates) {
      const log = globalData.dailyLogs[d]
      const habits = Array.isArray(log) ? log : (log?.habits || [])
      if (habits.includes(sid)) return d
    }
    return null
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 'var(--radius-sm)', padding: '8px 12px',
      }}>
        <span className="material-icons-round" style={{ color: '#555', fontSize: 20 }}>search</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Cerca abitudine o categoria..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '0.95em', padding: 0, margin: 0,
          }}
        />
        <button className="btn-icon" onClick={() => { setQuery(''); onClose() }}>
          <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{
          marginTop: 8, background: 'var(--card-solid)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)', overflow: 'hidden', animation: 'slideUp 0.18s ease',
        }}>
          {results.map(h => {
            const tag = tagsMap[h.tagId]
            const appearsToday = isToday(h)
            const lastDone = getLastDone(h)

            return (
              <div
                key={h.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onClick={() => { actions.openModal('singleHabit', h.id); onClose() }}
              >
                {tag && <div style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.92em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                  <div style={{ fontSize: '0.7em', color: appearsToday ? 'var(--success)' : '#555', marginTop: 2 }}>
                    {appearsToday ? '✓ Prevista oggi' : `Non prevista oggi${lastDone ? ` — ultima: ${lastDone.split('-').reverse().join('/')}` : ''}`}
                  </div>
                </div>
                <span className="material-icons-round" style={{ color: '#444', fontSize: 16 }}>chevron_right</span>
              </div>
            )
          })}
        </div>
      )}

      {query.trim().length > 0 && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85em', padding: '16px 0' }}>
          Nessuna abitudine trovata
        </div>
      )}
    </div>
  )
}
