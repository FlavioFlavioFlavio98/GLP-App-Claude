import { useState } from 'react'
import { useApp } from '../lib/store'

const ICONS = [
  { id: 'ti-heart', label: 'Cuore' }, { id: 'ti-brain', label: 'Mente' },
  { id: 'ti-coin', label: 'Moneta' }, { id: 'ti-apple', label: 'Cibo' },
  { id: 'ti-moon', label: 'Notte' }, { id: 'ti-users', label: 'Social' },
  { id: 'ti-home', label: 'Casa' }, { id: 'ti-briefcase', label: 'Lavoro' },
  { id: 'ti-palette', label: 'Arte' }, { id: 'ti-leaf', label: 'Natura' },
  { id: 'ti-run', label: 'Corsa' }, { id: 'ti-book', label: 'Studio' },
  { id: 'ti-music', label: 'Musica' }, { id: 'ti-sun', label: 'Sole' },
  { id: 'ti-droplet', label: 'Acqua' }, { id: 'ti-barbell', label: 'Palestra' },
  { id: 'ti-bed', label: 'Sonno' }, { id: 'ti-car', label: 'Auto' },
  { id: 'ti-plane', label: 'Viaggio' }, { id: 'ti-camera', label: 'Foto' },
  { id: 'ti-dog', label: 'Animali' }, { id: 'ti-bike', label: 'Bici' },
  { id: 'ti-swimming', label: 'Nuoto' }, { id: 'ti-yoga', label: 'Yoga' },
  { id: 'ti-meditation', label: 'Meditazione' }, { id: 'ti-pill', label: 'Salute' },
  { id: 'ti-salad', label: 'Dieta' }, { id: 'ti-chart-line', label: 'Crescita' },
  { id: 'ti-target', label: 'Obiettivo' }, { id: 'ti-trophy', label: 'Vittoria' },
  { id: 'ti-star', label: 'Stella' }, { id: 'ti-flame', label: 'Fuoco' },
  { id: 'ti-clock', label: 'Tempo' }, { id: 'ti-calendar', label: 'Calendario' },
  { id: 'ti-map', label: 'Mappa' }, { id: 'ti-phone', label: 'Telefono' },
  { id: 'ti-device-laptop', label: 'PC' }, { id: 'ti-tool', label: 'Lavori' },
  { id: 'ti-shirt', label: 'Stile' }, { id: 'ti-pencil', label: 'Scrittura' },
]

const BLANK = { name: '', color: '#3498db', icon: '', emoji: '' }

export default function TagModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [editIdx, setEditIdx] = useState(null)
  const [form, setForm] = useState(BLANK)

  if (modal !== 'tags') return null

  const tags = globalData?.tags || []
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function startEdit(idx) {
    const t = tags[idx]
    setEditIdx(idx)
    setForm({ name: t.name, color: t.color, icon: t.icon || '', emoji: t.emoji || '' })
  }

  function cancel() { setEditIdx(null); setForm(BLANK) }

  async function handleSave() {
    if (!form.name.trim()) return
    let newTags = [...tags]
    const entry = { id: editIdx !== null ? tags[editIdx].id : Date.now().toString(), name: form.name, color: form.color, icon: form.icon, emoji: form.emoji }
    if (editIdx !== null) newTags[editIdx] = entry
    else newTags.push(entry)
    await actions.saveTags(newTags)
    cancel()
  }

  async function handleDelete(idx) {
    if (!window.confirm('Eliminare tag?')) return
    const newTags = [...tags]; newTags.splice(idx, 1)
    await actions.saveTags(newTags)
  }

  // Icon/emoji display for pill
  const previewIcon = form.emoji
    ? <span>{form.emoji}</span>
    : form.icon
      ? <i className={`ti ${form.icon}`} style={{ fontSize: '0.85em' }} />
      : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>🏷️ Tag</h3>

        {/* Existing tags list */}
        <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 16 }}>
          {tags.length === 0 && <div className="empty-state">Nessun tag</div>}
          {tags.map((t, idx) => (
            <div className="tag-row" key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="color-dot" style={{ background: t.color }} />
                {t.emoji
                  ? <span style={{ fontSize: '1em' }}>{t.emoji}</span>
                  : t.icon ? <i className={`ti ${t.icon}`} style={{ color: t.color }} /> : null}
                <span>{t.name}</span>
              </div>
              <div className="actions-group">
                <button className="btn-icon" onClick={() => startEdit(idx)}><span className="material-icons-round">edit</span></button>
                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(idx)}><span className="material-icons-round">delete</span></button>
              </div>
            </div>
          ))}
        </div>

        {/* Create / Edit form */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {editIdx !== null ? 'Modifica Tag' : 'Nuovo Tag'}
          </div>

          {/* Live preview */}
          {(form.name || form.color) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <span className="tag-pill" style={{ background: form.color, fontSize: '0.85em', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {previewIcon}{form.name || 'Anteprima'}
              </span>
            </div>
          )}

          <input type="text" placeholder="Nome tag" value={form.name} onChange={e => set('name', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: '0.68em', color: '#666', marginBottom: 4 }}>Colore</div>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ height: 40 }} />
            </div>
            <div>
              <div style={{ fontSize: '0.68em', color: '#666', marginBottom: 4 }}>Emoji (opzionale)</div>
              <input type="text" placeholder="es. 💪" value={form.emoji} onChange={e => set('emoji', e.target.value.slice(0, 4))} maxLength={4} />
            </div>
          </div>

          {/* Icon picker grid */}
          <div style={{ fontSize: '0.68em', color: '#666', margin: '10px 0 6px' }}>
            Icona {form.emoji && <span style={{ color: 'var(--theme-color)' }}>(sostituita dall'emoji sopra)</span>}
          </div>
          <div className="icon-picker-grid">
            <button
              className={`icon-picker-btn${!form.icon ? ' selected' : ''}`}
              onClick={() => set('icon', '')}
              title="Nessuna icona"
            >
              <span className="material-icons-round" style={{ fontSize: 16 }}>block</span>
            </button>
            {ICONS.map(ic => (
              <button
                key={ic.id}
                className={`icon-picker-btn${form.icon === ic.id ? ' selected' : ''}`}
                onClick={() => set('icon', ic.id)}
                title={ic.label}
              >
                <i className={`ti ${ic.id}`} />
              </button>
            ))}
          </div>

          <button className="btn-main" onClick={handleSave} style={{ marginTop: 12 }}>
            {editIdx !== null ? 'Aggiorna' : 'Crea Tag'}
          </button>
          {editIdx !== null && <button className="btn-sec" onClick={cancel}>Annulla Modifica</button>}
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
