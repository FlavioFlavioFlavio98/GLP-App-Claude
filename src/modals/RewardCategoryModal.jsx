import { useState } from 'react'
import { useApp } from '../lib/store'

const BLANK = { name: '', color: '#d05ce3', emoji: '' }

export default function RewardCategoryModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [editIdx, setEditIdx] = useState(null)
  const [form, setForm] = useState(BLANK)

  if (modal !== 'rewardCategories') return null

  const categories = globalData?.rewardCategories || []
  const rewards = globalData?.rewards || []

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function startEdit(idx) {
    const c = categories[idx]
    setEditIdx(idx)
    setForm({ name: c.name, color: c.color, emoji: c.emoji || '' })
  }

  function cancelEdit() { setEditIdx(null); setForm(BLANK) }

  async function handleSave() {
    if (!form.name.trim()) return
    const newCats = [...categories]
    const entry = {
      id: editIdx !== null ? categories[editIdx].id : Date.now().toString(),
      name: form.name.trim(),
      color: form.color,
      emoji: form.emoji.trim(),
    }
    if (editIdx !== null) newCats[editIdx] = entry
    else newCats.push(entry)
    await actions.saveRewardCategories(newCats)
    cancelEdit()
  }

  async function handleDelete(idx) {
    const cat = categories[idx]
    const usedBy = rewards.filter(r => r.categoryId === cat.id).length
    if (usedBy > 0 && !window.confirm(`Questa categoria è usata da ${usedBy} premi. Eliminarla rimuoverà l'associazione. Continuare?`)) return
    if (!usedBy && !window.confirm('Eliminare questa categoria?')) return
    const newCats = [...categories]; newCats.splice(idx, 1)
    await actions.saveRewardCategories(newCats)
    cancelEdit()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>🛍️ Categorie Premi</h3>

        {/* List */}
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
          {categories.length === 0 && <div className="empty-state" style={{ padding: '12px 0' }}>Nessuna categoria — creane una</div>}
          {categories.map((c, idx) => (
            <div key={c.id} className="tag-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                {c.emoji && <span>{c.emoji}</span>}
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontSize: '0.68em', color: '#555' }}>({rewards.filter(r => r.categoryId === c.id).length} premi)</span>
              </div>
              <div className="actions-group">
                <button className="btn-icon" onClick={() => startEdit(idx)}><span className="material-icons-round">edit</span></button>
                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(idx)}><span className="material-icons-round">delete</span></button>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {editIdx !== null ? 'Modifica Categoria' : 'Nuova Categoria'}
          </div>
          <input type="text" placeholder="Nome categoria" value={form.name} onChange={e => set('name', e.target.value)} />
          <div className="grid-2" style={{ marginTop: 4 }}>
            <div>
              <div style={{ fontSize: '0.68em', color: '#666', marginBottom: 4 }}>Colore</div>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ height: 40 }} />
            </div>
            <div>
              <div style={{ fontSize: '0.68em', color: '#666', marginBottom: 4 }}>Emoji</div>
              <input type="text" placeholder="es. 🎁" value={form.emoji} onChange={e => set('emoji', e.target.value.slice(0, 4))} />
            </div>
          </div>
          {/* Preview */}
          {form.name && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <span className="tag-pill" style={{ background: form.color, fontSize: '0.85em', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {form.emoji && <span>{form.emoji}</span>}
                {form.name}
              </span>
            </div>
          )}
          <button className="btn-main" onClick={handleSave}>{editIdx !== null ? 'Aggiorna' : 'Crea Categoria'}</button>
          {editIdx !== null && <button className="btn-sec" onClick={cancelEdit}>Annulla</button>}
        </div>

        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
