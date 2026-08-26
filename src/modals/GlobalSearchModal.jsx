import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'

const TYPE_LABELS = {
  task: { label: 'Task', emoji: '📋' },
  habit: { label: 'Abitudine', emoji: '🔁' },
  recurring: { label: 'Task ricorrente', emoji: '🔁' },
  reward: { label: 'Reward', emoji: '🎁' },
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

const STATUS_LABEL = { active: 'attiva', completed: 'completata', expired: 'scaduta' }

export default function GlobalSearchModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (modal === 'globalSearch') {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [modal])

  if (modal !== 'globalSearch') return null

  const q = query.trim().toLowerCase()

  function matches(...fields) {
    return fields.some(f => (f || '').toLowerCase().includes(q))
  }

  let results = []
  if (q.length > 0) {
    const tasks = (globalData?.tasks || [])
      .filter(t => matches(t.title, t.description))
      .map(t => ({
        type: 'task',
        key: t.id,
        title: t.title,
        sub: `${STATUS_LABEL[t.status] || t.status}${t.deadline ? ` · ${fmtDate(t.deadline)}` : ''}`,
        onClick: () => actions.openModal('taskEdit', { task: t }),
      }))

    const habits = (globalData?.habits || [])
      .filter(h => h.type !== 'goal' && !h.archivedAt && matches(h.name, h.description))
      .map(h => ({
        type: 'habit',
        key: h.id || h.name,
        title: h.name,
        sub: h.description || '',
        onClick: () => actions.openModal('singleHabit', h.id),
      }))

    const recurring = (globalData?.recurringTasks || [])
      .filter(r => matches(r.title))
      .map(r => ({
        type: 'recurring',
        key: r.id,
        title: r.title,
        sub: r.active === false ? 'in pausa' : `ogni ${r.intervalDays === 1 ? 'giorno' : `${r.intervalDays} giorni`}`,
        onClick: () => actions.openModal('recurringTasks'),
      }))

    const rewards = (globalData?.rewards || [])
      .filter(r => matches(r.title, r.description))
      .map(r => ({
        type: 'reward',
        key: r.id,
        title: r.title,
        sub: r.description || '',
        onClick: () => actions.openModal('singleReward', r.id),
      }))

    results = [...tasks, ...habits, ...recurring, ...rewards].slice(0, 40)
  }

  return (
    <div
      className="modal-overlay"
      style={{ background: 'rgba(0,0,0,0.75)', alignItems: 'flex-start' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'var(--card-solid)', minHeight: '100vh', boxSizing: 'border-box',
        padding: '16px 16px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <span className="material-icons-round" style={{ color: '#555', fontSize: 20 }}>search</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Cerca in task, abitudini, reward..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.95em' }}
            />
          </div>
          <button className="btn-icon" onClick={() => actions.closeModal()}>
            <span className="material-icons-round" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {q.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85em', padding: '30px 0' }}>
            Cerca tra tutte le task (anche nei giorni futuri), abitudini, task ricorrenti e reward
          </div>
        )}

        {q.length > 0 && results.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85em', padding: '30px 0' }}>
            Nessun risultato per "{query}"
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(r => {
            const t = TYPE_LABELS[r.type]
            return (
              <button
                key={`${r.type}-${r.key}`}
                onClick={() => { r.onClick(); actions.closeModal() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text)',
                }}
              >
                <span style={{ fontSize: '1.2em', flexShrink: 0 }}>{t.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: '0.68em', color: '#666' }}>{t.label}{r.sub ? ` · ${r.sub}` : ''}</div>
                </div>
                <span className="material-icons-round" style={{ fontSize: 16, color: '#444', flexShrink: 0 }}>chevron_right</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
