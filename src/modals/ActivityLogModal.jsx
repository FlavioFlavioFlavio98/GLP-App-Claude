import { useState } from 'react'
import { useApp } from '../lib/store'

const TYPE_ICONS = {
  habit_created: '✨', habit_modified: '✏️', habit_archived: '📦', habit_deleted: '🗑️',
  reward_created: '🎁', reward_modified: '✏️', reward_deleted: '🗑️',
  tag_created: '🏷️', tag_modified: '🏷️', tag_deleted: '🏷️',
  category_created: '📂', category_modified: '📂', category_deleted: '📂',
  pin_changed: '🔒', backup_done: '💾', restore_done: '📥',
}

const TYPE_GROUPS = {
  habits: ['habit_created', 'habit_modified', 'habit_archived', 'habit_deleted'],
  rewards: ['reward_created', 'reward_modified', 'reward_deleted'],
  settings: ['tag_created', 'tag_modified', 'tag_deleted', 'category_created', 'category_modified', 'category_deleted', 'pin_changed', 'backup_done', 'restore_done'],
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(entries) {
  const groups = {}
  entries.forEach(e => {
    const day = formatDate(e.timestamp)
    if (!groups[day]) groups[day] = []
    groups[day].push(e)
  })
  return groups
}

export default function ActivityLogModal() {
  const { state, actions } = useApp()
  const { modal, globalData, allUsersData, currentUser } = state

  const [userFilter, setUserFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  if (modal !== 'activityLog') return null

  // Merge logs from both users
  const allLogs = []
  ;['flavio', 'simona'].forEach(u => {
    const log = allUsersData[u]?.activityLog || []
    allLogs.push(...log)
  })
  allLogs.sort((a, b) => b.timestamp - a.timestamp)

  const filtered = allLogs.filter(e => {
    if (userFilter !== 'all' && e.user !== userFilter) return false
    if (typeFilter !== 'all' && !TYPE_GROUPS[typeFilter]?.includes(e.type)) return false
    return true
  })

  const grouped = groupByDay(filtered)
  const days = Object.keys(grouped)

  async function clearLog() {
    if (!window.confirm('Cancellare tutto lo storico?')) return
    // Clear for both users if viewing all, or just current user
    const usersToClean = userFilter === 'all' ? ['flavio', 'simona'] : [userFilter]
    for (const u of usersToClean) {
      await actions.clearActivityLog(u)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ maxWidth: 480, width: '95%' }}>
        <div className="modal-header">
          <h3>📋 Storico Modifiche</h3>
          <button className="btn-icon" onClick={actions.closeModal}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* User filter */}
          <div className="switch-group" style={{ flex: 1, minWidth: 160 }}>
            {[['all', 'Tutti'], ['flavio', 'F'], ['simona', 'S']].map(([v, l]) => (
              <div key={v} className={`switch-opt${userFilter === v ? ' active' : ''}`}
                onClick={() => setUserFilter(v)}>
                {v === 'flavio' ? <span style={{ color: 'var(--flavio-color)' }}>F</span>
                  : v === 'simona' ? <span style={{ color: 'var(--simona-color)' }}>S</span>
                  : l}
              </div>
            ))}
          </div>
          {/* Type filter */}
          <div className="switch-group" style={{ flex: 2, minWidth: 220 }}>
            {[['all', 'Tutto'], ['habits', 'Abitudini'], ['rewards', 'Premi'], ['settings', 'Impost.']].map(([v, l]) => (
              <div key={v} className={`switch-opt${typeFilter === v ? ' active' : ''}`}
                onClick={() => setTypeFilter(v)}>{l}</div>
            ))}
          </div>
        </div>

        {/* Log list */}
        <div style={{ maxHeight: '58vh', overflowY: 'auto' }}>
          {days.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>
              Nessuna attività registrata
            </div>
          ) : days.map(day => (
            <div key={day}>
              <div style={{
                fontSize: '0.68em', color: '#555', textTransform: 'uppercase',
                letterSpacing: '1px', padding: '10px 0 6px', fontWeight: 700,
                position: 'sticky', top: 0, background: 'var(--card-solid)', zIndex: 1,
              }}>{day}</div>
              {grouped[day].map(entry => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: entry.user === 'flavio' ? 'var(--flavio-color)' : 'var(--simona-color)',
                    color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72em', fontWeight: 700,
                  }}>
                    {entry.user === 'flavio' ? 'F' : 'S'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.85em' }}>{TYPE_ICONS[entry.type] || '•'}</span>
                      <span style={{ fontSize: '0.88em', flex: 1 }}>{entry.description}</span>
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2 }}>
                        {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7em', color: '#444', flexShrink: 0 }}>
                    {formatTime(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Clear button */}
        {days.length > 0 && (
          <button className="btn-danger" style={{ marginTop: 16, fontSize: '0.82em' }} onClick={clearLog}>
            🗑️ Cancella storico
          </button>
        )}

        <button className="btn-sec" onClick={actions.closeModal}>Chiudi</button>
      </div>
    </div>
  )
}
