import { useState } from 'react'
import { useApp } from '../lib/store'

export default function TagModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [editIdx, setEditIdx] = useState(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3498db')

  if (modal !== 'tags') return null

  const tags = globalData?.tags || []

  function startEdit(idx) {
    setEditIdx(idx)
    setName(tags[idx].name)
    setColor(tags[idx].color)
  }

  async function handleSave() {
    if (!name.trim()) return
    let newTags = [...tags]
    if (editIdx !== null) {
      newTags[editIdx] = { ...newTags[editIdx], name, color }
    } else {
      newTags.push({ id: Date.now().toString(), name, color })
    }
    await actions.saveTags(newTags)
    setName(''); setColor('#3498db'); setEditIdx(null)
  }

  async function handleDelete(idx) {
    if (!window.confirm('Eliminare tag?')) return
    const newTags = [...tags]
    newTags.splice(idx, 1)
    await actions.saveTags(newTags)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>Tag</h3>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 15 }}>
          {tags.map((t, idx) => (
            <div className="tag-row" key={t.id}>
              <div><span className="color-dot" style={{ background: t.color }} />{t.name}</div>
              <div className="actions-group">
                <button className="btn-icon" onClick={() => startEdit(idx)}><span className="material-icons-round">edit</span></button>
                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(idx)}><span className="material-icons-round">delete</span></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#2a2a2a', padding: 10, borderRadius: 8 }}>
          <input type="text" placeholder="Nome tag" value={name} onChange={e => setName(e.target.value)} />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 40, margin: '5px 0' }} />
          <button className="btn-main" onClick={handleSave}>{editIdx !== null ? 'Aggiorna Tag' : 'Crea Tag'}</button>
          {editIdx !== null && <button className="btn-sec" onClick={() => { setEditIdx(null); setName(''); setColor('#3498db') }}>Annulla Modifica</button>}
        </div>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Chiudi</button>
      </div>
    </div>
  )
}
