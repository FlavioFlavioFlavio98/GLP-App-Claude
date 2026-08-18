import { useState } from 'react'

// Icona ingranaggio che apre un editor inline per il tasso punti/minuto di
// un'attività (Mobility, Barefoot, ...) — usata accanto al bottone "Aggiungi
// sessione" così la modifica resta nella sezione stessa, non in Impostazioni.
export default function ActivityRateEditor({ getRate, setRate, unit = 'pt/min', label = 'Punti' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(String(getRate()))
    setEditing(true)
  }

  function save() {
    const n = parseFloat(draft.replace(',', '.'))
    if (!isNaN(n) && n > 0) setRate(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          style={{
            width: 56, padding: '6px 8px', borderRadius: 8, textAlign: 'center',
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-color)',
            color: 'var(--text)', fontSize: '0.85em',
          }}
        />
        <span style={{ fontSize: '0.65em', color: '#666', whiteSpace: 'nowrap' }}>{unit}</span>
        <button onClick={save} className="btn-icon" style={{ padding: 2 }} title="Salva">
          <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--success, #4caf50)' }}>check</span>
        </button>
        <button onClick={() => setEditing(false)} className="btn-icon" style={{ padding: 2 }} title="Annulla">
          <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>close</span>
        </button>
      </div>
    )
  }

  return (
    <button onClick={startEdit} className="btn-icon" title={`Modifica ${label.toLowerCase()}`} style={{ padding: 6, flexShrink: 0 }}>
      <span className="material-icons-round" style={{ fontSize: 20, color: '#666' }}>settings</span>
    </button>
  )
}
