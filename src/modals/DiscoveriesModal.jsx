import { useState } from 'react'
import { useApp } from '../lib/store'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr) {
  const today = new Date(todayStr() + 'T00:00:00')
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function dueLabel(dateStr) {
  const n = daysUntil(dateStr)
  if (n === 0) return { text: 'Oggi', color: 'var(--theme-color)' }
  if (n < 0) return { text: `${-n}g fa`, color: '#EB5757' }
  if (n === 1) return { text: 'Domani', color: 'var(--text-sec)' }
  return { text: `tra ${n}g`, color: 'var(--text-sec)' }
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 11px',
  color: 'var(--text)', fontSize: '0.85em', outline: 'none',
}
const labelStyle = { fontSize: '0.68em', color: 'var(--text-sec)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' }

function DiscoveryForm({ initial, onCancel, onSave, saveLabel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [note, setNote] = useState(initial?.note || '')
  const [intervalDays, setIntervalDays] = useState(initial?.intervalDays ?? 3)
  const [nextReviewAt, setNextReviewAt] = useState(initial?.nextReviewAt || todayStr())

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span style={labelStyle}>Titolo</span>
        <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Mascherina per dormire" autoFocus />
      </div>
      <div>
        <span style={labelStyle}>Dettagli (opzionale)</span>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Note, contesto, cosa vuoi verificare..." />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Ripassa ogni (giorni)</span>
          <input style={inputStyle} type="number" min="1" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Prossimo ripasso</span>
          <input style={inputStyle} type="date" value={nextReviewAt} onChange={e => setNextReviewAt(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-sec)', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' }}
        >
          Annulla
        </button>
        <button
          onClick={() => {
            if (!title.trim()) return
            onSave({ title, note, intervalDays, nextReviewAt })
          }}
          style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--theme-color)', color: '#000', fontSize: '0.82em', fontWeight: 800, cursor: 'pointer' }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

function DiscoveryRow({ d, actions, editing, onStartEdit, onCancelEdit }) {
  if (editing) {
    return (
      <DiscoveryForm
        initial={d}
        saveLabel="Salva modifiche"
        onCancel={onCancelEdit}
        onSave={updates => { actions.updateDiscovery(d.id, updates); onCancelEdit() }}
      />
    )
  }

  const due = dueLabel(d.nextReviewAt)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: '0.9em', fontWeight: 700, color: 'var(--text)' }}>{d.title}</div>
        <span style={{ fontSize: '0.68em', fontWeight: 700, color: due.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{due.text}</span>
      </div>

      {d.note && (
        <div style={{ fontSize: '0.78em', color: 'var(--text-sec)', marginTop: 4, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{d.note}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.68em', color: 'var(--text-sec)' }}>
        <span>🔁 ogni {d.intervalDays}g</span>
        <span>📅 prossimo: {fmtDate(d.nextReviewAt)}</span>
        <span>✅ ripassata {d.reviewCount || 0}×</span>
        {d.lastReviewedAt && <span>ultima: {fmtDate(d.lastReviewedAt.slice(0, 10))}</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          onClick={() => actions.reviewDiscovery(d.id)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--theme-color)', color: '#000', fontSize: '0.75em', fontWeight: 800, cursor: 'pointer' }}
        >
          <span className="material-icons-round" style={{ fontSize: 15 }}>check_circle</span>
          Ripassa ora
        </button>
        <button onClick={onStartEdit} className="btn-icon" title="Modifica">
          <span className="material-icons-round" style={{ fontSize: 17, color: 'var(--text-sec)' }}>edit</span>
        </button>
        <button onClick={() => actions.archiveDiscovery(d.id, !d.archived)} className="btn-icon" title={d.archived ? 'Ripristina' : 'Archivia'}>
          <span className="material-icons-round" style={{ fontSize: 17, color: 'var(--text-sec)' }}>{d.archived ? 'unarchive' : 'archive'}</span>
        </button>
        <button onClick={() => actions.deleteDiscovery(d.id)} className="btn-icon" title="Elimina">
          <span className="material-icons-round" style={{ fontSize: 17, color: '#EB5757' }}>delete</span>
        </button>
      </div>
    </div>
  )
}

export default function DiscoveriesModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  if (modal !== 'discoveries') return null

  const all = globalData?.discoveries || []
  const active = all.filter(d => !d.archived).sort((a, b) => (a.nextReviewAt || '').localeCompare(b.nextReviewAt || ''))
  const archived = all.filter(d => d.archived)

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 36px',
        border: '1px solid var(--card-border)',
        animation: 'slideUp 0.22s ease',
        maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box',
      }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
            💡 Scoperte
          </div>
          <button className="btn-icon" onClick={() => actions.closeModal()}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', marginBottom: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
              fontSize: '0.9em', fontWeight: 700,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 20 }}>add_circle</span>
            Nuova scoperta
          </button>
        )}

        {adding && (
          <DiscoveryForm
            saveLabel="Salva"
            onCancel={() => setAdding(false)}
            onSave={data => { actions.addDiscovery(data); setAdding(false) }}
          />
        )}

        {active.length === 0 && !adding && (
          <div style={{ textAlign: 'center', color: 'var(--text-sec)', fontSize: '0.85em', padding: '24px 0' }}>
            Nessuna scoperta salvata. Aggiungi qualcosa che vuoi ricordare e riprovare tra qualche giorno.
          </div>
        )}

        {active.map(d => (
          <DiscoveryRow
            key={d.id}
            d={d}
            actions={actions}
            editing={editingId === d.id}
            onStartEdit={() => setEditingId(d.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}

        {archived.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(v => !v)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                color: 'var(--text-sec)', fontSize: '0.75em', fontWeight: 700, cursor: 'pointer',
                padding: '10px 2px', textTransform: 'uppercase', letterSpacing: 0.4,
              }}
            >
              {showArchived ? '▾' : '▸'} Archiviate ({archived.length})
            </button>
            {showArchived && archived.map(d => (
              <DiscoveryRow
                key={d.id}
                d={d}
                actions={actions}
                editing={editingId === d.id}
                onStartEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
