import { useState } from 'react'
import { useApp } from '../lib/store'

function formatDate(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PRIORITY_COLORS = { high: '#e53935', medium: '#ff7043', low: '#42a5f5' }
const PRIORITY_LABELS = { high: 'ALTA', medium: 'MEDIA', low: 'BASSA' }

export default function TaskHistoryModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [tab, setTab] = useState('completed')
  const [reopenId, setReopenId] = useState(null)
  const [reopenDate, setReopenDate] = useState(tomorrow())

  if (modal !== 'taskHistory') return null

  const allTasks = globalData?.tasks || []
  const completed = allTasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  const expired = allTasks
    .filter(t => t.status === 'expired')
    .sort((a, b) => (b.expiredAt || '').localeCompare(a.expiredAt || ''))

  async function handleReopen(task) {
    if (!reopenDate || !/^\d{4}-\d{2}-\d{2}$/.test(reopenDate)) {
      actions.showToast('Data non valida', '⚠️'); return
    }
    await actions.reopenTask(task, reopenDate)
    setReopenId(null)
    setReopenDate(tomorrow())
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-start', background: 'rgba(0,0,0,0.7)', paddingTop: 0 }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 14,
        }}>
          <button
            onClick={() => actions.closeModal()}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <div style={{ fontWeight: 700, fontSize: '1em', color: 'var(--text)' }}>🕐 Storico Task</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '12px 16px 0', gap: 8 }}>
          {[['completed','✅ Completate', completed.length],['expired','💀 Scadute', expired.length]].map(([t,l,count]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 10,
                border: `1px solid ${tab === t ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
                background: tab === t ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
                color: tab === t ? 'var(--theme-color)' : '#666',
                fontWeight: 700, fontSize: '0.82em', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{l} ({count})</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
          {tab === 'completed' && (
            completed.length === 0
              ? <EmptyState text="Nessuna task completata ancora" />
              : completed.map(task => (
                <CompletedItem
                  key={task.id}
                  task={task}
                  onUncomplete={() => actions.uncompleteTask(task)}
                />
              ))
          )}
          {tab === 'expired' && (
            expired.length === 0
              ? <EmptyState text="Nessuna task scaduta" />
              : expired.map(task => (
                <ExpiredItem
                  key={task.id}
                  task={task}
                  isReopening={reopenId === task.id}
                  reopenDate={reopenDate}
                  onReopenDateChange={setReopenDate}
                  onStartReopen={() => { setReopenId(task.id); setReopenDate(tomorrow()) }}
                  onCancelReopen={() => setReopenId(null)}
                  onConfirmReopen={() => handleReopen(task)}
                  onDelete={() => actions.deleteExpiredTask(task.id)}
                />
              ))
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="empty-state" style={{ marginTop: 40, fontSize: '0.84em' }}>{text}</div>
  )
}

function CompletedItem({ task, onUncomplete }) {
  const pColor = PRIORITY_COLORS[task.priority] || '#ff7043'
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
      border: '1px solid var(--card-border)', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '1.1em', marginTop: 1 }}>✅</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--text)' }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2 }}>{task.description}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7em', color: '#666' }}>
              Completata il {formatDate(task.completedAt)}
            </span>
            <span style={{ fontSize: '0.7em', color: '#4caf50', fontWeight: 700 }}>
              +{task.reward}pt
            </span>
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: pColor,
              background: `${pColor}22`, borderRadius: 4, padding: '1px 5px',
            }}>{PRIORITY_LABELS[task.priority] || 'MEDIA'}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onUncomplete}
        style={{
          marginTop: 10, width: '100%', padding: '7px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          color: '#666', cursor: 'pointer', fontSize: '0.78em',
        }}
      >↩ Annulla completamento</button>
    </div>
  )
}

function ExpiredItem({ task, isReopening, reopenDate, onReopenDateChange, onStartReopen, onCancelReopen, onConfirmReopen, onDelete }) {
  const pColor = PRIORITY_COLORS[task.priority] || '#ff7043'
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
      border: '1px solid rgba(229,57,53,0.2)', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '1.1em', marginTop: 1 }}>💀</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--text)' }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: '0.72em', color: '#555', marginTop: 2 }}>{task.description}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7em', color: '#666' }}>
              Scaduta il {formatDate(task.expiredAt || task.deadline)}
            </span>
            {task.penaltyApplied && task.penalty > 0 && (
              <span style={{ fontSize: '0.7em', color: '#e53935', fontWeight: 700 }}>
                -{task.penalty}pt
              </span>
            )}
            <span style={{
              fontSize: '0.63em', fontWeight: 700, color: pColor,
              background: `${pColor}22`, borderRadius: 4, padding: '1px 5px',
            }}>{PRIORITY_LABELS[task.priority] || 'MEDIA'}</span>
          </div>
        </div>
      </div>

      {isReopening ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.72em', color: '#666', marginBottom: 6 }}>Nuova data scadenza:</div>
          <input
            type="date" value={reopenDate}
            onChange={e => onReopenDateChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--theme-color)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
              fontSize: '0.88em', boxSizing: 'border-box', colorScheme: 'dark',
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancelReopen} style={secondaryBtnStyle}>Annulla</button>
            <button onClick={onConfirmReopen} className="btn-main" style={{ flex: 2, padding: '8px', fontSize: '0.82em' }}>
              Riapri task
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button onClick={onDelete} style={{ ...secondaryBtnStyle, color: '#e53935' }}>🗑️ Elimina</button>
          <button onClick={onStartReopen} style={{ ...secondaryBtnStyle, flex: 2 }}>↩ Riapri</button>
        </div>
      )}
    </div>
  )
}

const secondaryBtnStyle = {
  flex: 1, padding: '7px 8px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#666', cursor: 'pointer', fontSize: '0.78em',
}
