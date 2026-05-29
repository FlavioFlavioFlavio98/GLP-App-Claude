import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'

export default function EditModal() {
  const { state, actions } = useApp()
  const { modal, modalPayload, globalData } = state
  const [f, setF] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveDate, setArchiveDate] = useState(toDateString(new Date()))

  useEffect(() => {
    if (modal !== 'edit' || !modalPayload || !globalData) { setF(null); return }
    const { id, type } = modalPayload
    const list = type === 'habit' ? globalData.habits : globalData.rewards
    const item = list.find(i => i.id === id)
    if (!item) return
    setF({
      item,
      type,
      name: item.name,
      desc: item.description || '',
      tagId: item.tagId || '',
      editDate: toDateString(new Date()),
      note: '',
      reward: item.reward || 0,
      penalty: item.penalty || 0,
      rewardMin: item.rewardMin || 0,
      isMulti: item.isMulti || false,
      cost: item.cost || 0,
    })
    setShowArchive(false)
  }, [modal, modalPayload])

  if (modal !== 'edit' || !f) return null

  function set(key, val) { setF(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    const { item, type } = f
    if (!f.editDate) { alert('Data obbligatoria'); return }

    let logs = []
    if (item.name !== f.name) logs.push(`Nome: ${item.name} → ${f.name}`)
    if (type === 'habit') {
      if (item.reward !== parseInt(f.reward)) logs.push(`Max: ${item.reward} → ${f.reward}`)
      if (item.penalty !== parseInt(f.penalty)) logs.push(`Penalty: ${item.penalty} → ${f.penalty}`)
      if ((item.rewardMin || 0) !== parseInt(f.rewardMin)) logs.push(`Min: ${item.rewardMin || 0} → ${f.rewardMin}`)
    } else {
      if (item.cost !== parseInt(f.cost)) logs.push(`Costo: ${item.cost} → ${f.cost}`)
    }
    const autoNote = logs.length > 0 && !f.note ? 'Modifica: ' + logs.join(', ') : f.note

    const newChange = { date: f.editDate, note: autoNote || undefined }
    if (type === 'habit') {
      newChange.reward = parseInt(f.reward) || 0
      newChange.penalty = parseInt(f.penalty) || 0
      newChange.rewardMin = parseInt(f.rewardMin) || 0
      newChange.isMulti = f.isMulti
      newChange.description = f.desc
    } else {
      newChange.cost = parseInt(f.cost) || 0
    }

    let changes = item.changes ? [...item.changes] : [{ date: '2020-01-01', note: 'Creazione Iniziale', ...(type === 'habit' ? { reward: item.reward, penalty: item.penalty, isMulti: item.isMulti || false, rewardMin: item.rewardMin || 0, description: item.description || '' } : { cost: item.cost }) }]
    changes = changes.filter(c => c.date !== f.editDate)
    changes.push(newChange)
    changes.sort((a, b) => a.date.localeCompare(b.date))

    const updated = {
      ...item,
      name: f.name,
      tagId: f.tagId,
      description: f.desc,
      changes,
      ...(type === 'habit' ? { reward: parseInt(f.reward) || 0, penalty: parseInt(f.penalty) || 0, rewardMin: parseInt(f.rewardMin) || 0, isMulti: f.isMulti } : { cost: parseInt(f.cost) || 0 }),
    }
    await actions.saveEdit(updated, type)
    actions.closeModal()
  }

  async function handleDelete() {
    if (!window.confirm('SEI SICURO? ⚠️\nQuesta azione eliminerà DEFINITIVAMENTE l\'elemento.\nNon potrai tornare indietro.')) return
    await actions.deleteItem(f.item.id, f.type)
    actions.closeModal()
  }

  async function handleArchive() {
    await actions.archiveItem(f.item.id, f.type, archiveDate)
    setShowArchive(false)
    actions.closeModal()
  }

  const tags = globalData?.tags || []
  const changes = f.item.changes ? [...f.item.changes].sort((a, b) => a.date.localeCompare(b.date)) : []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>Modifica</h3>

        <div className="input-group"><label>Data modifica</label><input type="date" value={f.editDate} onChange={e => set('editDate', e.target.value)} /></div>
        <div className="input-group"><label>Nome</label><input type="text" value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="input-group"><label>Descrizione</label><input type="text" placeholder="Descrizione..." value={f.desc} onChange={e => set('desc', e.target.value)} /></div>
        <div className="input-group">
          <label>Tag</label>
          <select value={f.tagId} onChange={e => set('tagId', e.target.value)}>
            <option value="">Nessun Tag</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {f.type === 'habit' && (
          <>
            <div style={{ margin: '15px 0', display: 'flex', alignItems: 'center', gap: 10, background: '#2a2a2a', padding: 10, borderRadius: 8 }}>
              <input type="checkbox" id="editIsMulti" style={{ width: 20, height: 20, margin: 0 }} checked={f.isMulti} onChange={e => set('isMulti', e.target.checked)} />
              <label htmlFor="editIsMulti" style={{ fontSize: '0.9em', margin: 0 }}>Abilita livelli Min/Max?</label>
            </div>
            <div className="grid-2">
              <div className="input-group"><label>{f.isMulti ? 'Reward (Max)' : 'Reward'}</label><input type="number" value={f.reward} onChange={e => set('reward', e.target.value)} /></div>
              <div className="input-group"><label>Penalità</label><input type="number" value={f.penalty} onChange={e => set('penalty', e.target.value)} /></div>
            </div>
            {f.isMulti && (
              <div className="input-group" style={{ borderTop: '1px solid #333', paddingTop: 5 }}>
                <label style={{ color: 'var(--theme-color)' }}>Reward Minimo (Min)</label>
                <input type="number" value={f.rewardMin} onChange={e => set('rewardMin', e.target.value)} />
              </div>
            )}
          </>
        )}

        {f.type === 'reward' && (
          <div className="input-group"><label>Costo</label><input type="number" value={f.cost} onChange={e => set('cost', e.target.value)} /></div>
        )}

        <div className="input-group">
          <label>Nota Modifica (automatica se vuota)</label>
          <textarea rows="2" placeholder="Lascia vuoto per log automatico..." value={f.note} onChange={e => set('note', e.target.value)} />
        </div>

        {changes.length > 0 && (
          <div className="history-list">
            {changes.map((c, i) => (
              <div className="history-item" key={i}>
                <div className="history-date">{c.date.split('-').reverse().join('/')}</div>
                <div>{i === 0 ? 'Creazione iniziale' : 'Aggiornamento valori'}</div>
                {c.note && <div className="history-note">{c.note}</div>}
              </div>
            ))}
          </div>
        )}

        <button className="btn-main" onClick={handleSave}>Salva Modifiche</button>

        {showArchive ? (
          <div style={{ marginTop: 15, background: '#2a2a2a', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: '0.85em', color: '#aaa' }}>Data archiviazione</label>
            <input type="date" value={archiveDate} onChange={e => setArchiveDate(e.target.value)} />
            <button className="btn-danger" style={{ borderColor: '#ff9800', color: '#ff9800' }} onClick={handleArchive}>Conferma Archiviazione</button>
            <button className="btn-sec" onClick={() => setShowArchive(false)}>Annulla</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn-danger" style={{ borderColor: '#ff9800', color: '#ff9800' }} onClick={() => setShowArchive(true)}>Archivia</button>
            <button className="btn-danger" onClick={handleDelete}>Elimina Definitivamente</button>
          </div>
        )}

        <button className="btn-sec" onClick={() => actions.closeModal()}>Annulla</button>
      </div>
    </div>
  )
}
