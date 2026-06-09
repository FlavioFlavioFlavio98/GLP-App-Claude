import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import RewardCategoryPicker from './RewardCategoryPicker'
import { TIME_SLOT_OPTS } from '../lib/timeSlots'

function NumericConfigForm({ f, set }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Configurazione Numerica</div>

      <div className="grid-2">
        <div className="input-group">
          <label>Unità di misura</label>
          <input type="text" placeholder="es. passi, km, ore" value={f.numUnit} onChange={e => set('numUnit', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Tipo input</label>
          <div className="switch-group" style={{ marginTop: 6 }}>
            <div className={`switch-opt${f.numInputType === 'integer' ? ' active' : ''}`} onClick={() => set('numInputType', 'integer')}>Intero</div>
            <div className={`switch-opt${f.numInputType === 'decimal' ? ' active' : ''}`} onClick={() => set('numInputType', 'decimal')}>Decimale</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="input-group">
          <label>Punti per unità</label>
          <input type="number" step="0.01" placeholder="es. 0.2" value={f.numPointsPerUnit} onChange={e => set('numPointsPerUnit', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Per ogni (quantità)</label>
          <input type="number" placeholder="es. 1000" value={f.numUnitSize} onChange={e => set('numUnitSize', e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 10 }}>
        Formula: {f.numPointsPerUnit || '?'} pt ogni {f.numUnitSize || '?'} {f.numUnit || 'unità'}
      </div>

      <div className="grid-2">
        <div className="input-group">
          <label>Soglia minima</label>
          <input type="number" placeholder="sotto cui si applica regola" value={f.numThreshold} onChange={e => set('numThreshold', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Cap massimo pt (0 = nessun limite)</label>
          <input type="number" placeholder="es. 10" value={f.numCap} onChange={e => set('numCap', e.target.value)} />
        </div>
      </div>

      <div className="input-group">
        <label>Sotto soglia</label>
        <div className="switch-group" style={{ marginTop: 6 }}>
          <div className={`switch-opt${f.numBelowThreshold === 'zero' ? ' active' : ''}`} onClick={() => set('numBelowThreshold', 'zero')}>0 pt</div>
          <div className={`switch-opt${f.numBelowThreshold === 'fixed' ? ' active' : ''}`} onClick={() => set('numBelowThreshold', 'fixed')}>Penalità fissa</div>
          <div className={`switch-opt${f.numBelowThreshold === 'proportional' ? ' active' : ''}`} onClick={() => set('numBelowThreshold', 'proportional')}>Proporzionale</div>
        </div>
      </div>
      {f.numBelowThreshold === 'fixed' && (
        <div className="input-group">
          <label>Penalità fissa (pt)</label>
          <input type="number" placeholder="es. 5" value={f.numPenaltyFixed} onChange={e => set('numPenaltyFixed', e.target.value)} />
        </div>
      )}
    </div>
  )
}

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
    const nc = item.numericConfig || {}
    const habitType = item.numericConfig ? 'numeric' : item.goalConfig ? 'goal' : item.isMulti ? 'multi' : 'normal'
    setF({
      item,
      type,
      habitType,
      name: item.name,
      desc: item.description || '',
      tagId: item.tagId || '',
      why: item.why || '',
      importance: item.importance || 'medium',
      timeSlot: item.timeSlot || null,
      editDate: toDateString(new Date()),
      note: '',
      reward: item.reward || 0,
      penalty: item.penalty || 0,
      rewardMin: item.rewardMin || 0,
      isMulti: item.isMulti || false,
      cost: item.cost || 0,
      categoryId: item.categoryId || '',
      // tracked reward fields
      rewardType: item.type === 'tracked' ? 'tracked' : 'normal',
      trackedEmoji: item.emoji || '',
      trackedUnit: item.unit || '',
      trackedCostPerThreshold: item.costPerThreshold ?? 5,
      trackedThreshold: item.threshold ?? 10,
      // numeric config fields (prefixed with num to avoid collisions)
      numUnit: nc.unit || '',
      numInputType: nc.inputType || 'integer',
      numThreshold: nc.threshold != null ? nc.threshold : '',
      numBelowThreshold: nc.belowThreshold || 'zero',
      numPenaltyFixed: nc.penaltyFixed || '',
      numPointsPerUnit: nc.pointsPerUnit || '',
      numUnitSize: nc.unitSize || '',
      numCap: nc.cap != null ? nc.cap : '',
    })
    setShowArchive(false)
  }, [modal, modalPayload])

  if (modal !== 'edit' || !f) return null

  function set(key, val) { setF(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    const { item, type } = f
    if (!f.editDate) { alert('Data obbligatoria'); return }

    // FIX 3: include tag (and all other fields) in the change log comparison
    const tags = globalData?.tags || []
    const getTagName = id => tags.find(t => t.id === id)?.name || 'Nessuno'

    let logs = []
    if (item.name !== f.name) logs.push(`Nome: ${item.name} → ${f.name}`)
    if ((item.tagId || '') !== (f.tagId || '')) logs.push(`Tag: ${getTagName(item.tagId)} → ${getTagName(f.tagId)}`)
    if ((item.description || '') !== (f.desc || '')) logs.push('Descrizione aggiornata')
    if (type === 'habit') {
      if (item.reward !== parseInt(f.reward)) logs.push(`Max: ${item.reward} → ${f.reward}`)
      if (item.penalty !== parseInt(f.penalty)) logs.push(`Penalty: ${item.penalty} → ${f.penalty}`)
      if ((item.rewardMin || 0) !== parseInt(f.rewardMin)) logs.push(`Min: ${item.rewardMin || 0} → ${f.rewardMin}`)
      if ((item.isMulti || false) !== f.isMulti) logs.push(`MultiLevel: ${item.isMulti ? 'Sì' : 'No'} → ${f.isMulti ? 'Sì' : 'No'}`)
    } else {
      if (item.cost !== parseInt(f.cost)) logs.push(`Costo: ${item.cost} → ${f.cost}`)
    }
    const autoNote = logs.length > 0 && !f.note ? 'Modifica: ' + logs.join(', ') : f.note

    const newChange = { date: f.editDate, note: autoNote || null }
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

    const numericConfig = f.habitType === 'numeric' ? {
      unit: f.numUnit || '',
      inputType: f.numInputType || 'integer',
      threshold: parseFloat(f.numThreshold) || 0,
      belowThreshold: f.numBelowThreshold || 'zero',
      penaltyFixed: parseFloat(f.numPenaltyFixed) || 0,
      pointsPerUnit: parseFloat(f.numPointsPerUnit) || 0,
      unitSize: parseFloat(f.numUnitSize) || 1,
      cap: f.numCap !== '' && f.numCap != null ? parseFloat(f.numCap) : null,
    } : null

    const rewardFields = type === 'habit'
      ? { reward: parseInt(f.reward) || 0, penalty: parseInt(f.penalty) || 0, rewardMin: parseInt(f.rewardMin) || 0, isMulti: f.isMulti, numericConfig, numericType: f.habitType === 'numeric' || null }
      : f.rewardType === 'tracked'
        ? { type: 'tracked', emoji: f.trackedEmoji || '', unit: f.trackedUnit, costPerThreshold: parseInt(f.trackedCostPerThreshold) || 0, threshold: parseInt(f.trackedThreshold) || 1 }
        : { cost: parseInt(f.cost) || 0, categoryId: f.categoryId || '' }

    const updated = {
      ...item,
      name: f.name || item.name,
      tagId: f.tagId || '',
      description: f.desc || '',
      importance: f.importance || 'medium',
      timeSlot: f.timeSlot || null,
      why: f.why?.trim() || null,
      changes,
      ...rewardFields,
    }
    console.log('[EditModal] saving', type, updated)
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
            <div className="input-group" style={{ marginBottom: 8 }}>
              <label>Tipo abitudine</label>
              <div className="switch-group" style={{ marginTop: 4 }}>
                {[{ v: 'normal', label: 'Normale' }, { v: 'multi', label: 'Multi' }, { v: 'numeric', label: 'Numerica' }].map(opt => (
                  <div key={opt.v} className={`switch-opt${f.habitType === opt.v ? ' active' : ''}`} onClick={() => set('habitType', opt.v)}>{opt.label}</div>
                ))}
              </div>
            </div>

            {f.habitType === 'numeric' ? (
              <NumericConfigForm f={f} set={set} />
            ) : (
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
          </>
        )}

        {f.type === 'reward' && (
          <>
            {f.rewardType === 'tracked' ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, margin: '8px 0' }}>
                <div style={{ fontSize: '0.7em', color: '#888', marginBottom: 8, fontWeight: 700 }}>📊 Premio Speciale</div>
                <div className="input-group"><label>Emoji (opzionale)</label>
                  <input type="text" value={f.trackedEmoji} onChange={e => set('trackedEmoji', e.target.value)} placeholder="Es. 🍺" /></div>
                <div className="input-group"><label>Unità di misura</label>
                  <input type="text" value={f.trackedUnit} onChange={e => set('trackedUnit', e.target.value)} /></div>
                <div className="grid-2">
                  <div className="input-group"><label>Costo (pt)</label>
                    <input type="number" min="0" value={f.trackedCostPerThreshold} onChange={e => set('trackedCostPerThreshold', e.target.value)} /></div>
                  <div className="input-group"><label>Ogni (quantità)</label>
                    <input type="number" min="1" value={f.trackedThreshold} onChange={e => set('trackedThreshold', e.target.value)} /></div>
                </div>
                <div style={{ fontSize: '0.68em', color: '#555' }}>
                  {f.trackedCostPerThreshold}pt ogni {f.trackedThreshold} {f.trackedUnit || 'unità'}
                </div>
              </div>
            ) : (
              <>
                <div className="input-group"><label>Costo</label><input type="number" value={f.cost} onChange={e => set('cost', e.target.value)} /></div>
                <RewardCategoryPicker
                  categories={globalData?.rewardCategories || []}
                  value={f.categoryId || ''}
                  onChange={v => set('categoryId', v)}
                />
              </>
            )}
          </>
        )}

        {f.type === 'habit' && (
          <div className="input-group">
            <label>Importanza</label>
            <div className="switch-group" style={{ marginTop: 4 }}>
              {[{ v:'low',icon:'🔵',label:'Bassa'},{v:'medium',icon:'🟡',label:'Media'},{v:'high',icon:'🔴',label:'Alta'}].map(opt => (
                <div key={opt.v} className={`switch-opt${f.importance === opt.v ? ' active' : ''}`} onClick={() => set('importance', opt.v)}>
                  {opt.icon} {opt.label}
                </div>
              ))}
            </div>
          </div>
        )}
        {f.type === 'habit' && (
          <div className="input-group">
            <label>Fascia oraria (opzionale)</label>
            <div className="switch-group" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              {TIME_SLOT_OPTS.map(opt => (
                <div key={String(opt.v)} className={`switch-opt${f.timeSlot === opt.v ? ' active' : ''}`} onClick={() => set('timeSlot', opt.v)}>
                  {opt.icon
                    ? <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3, color: opt.color }}>{opt.icon}</span>
                    : <span style={{ marginRight: 3 }}>⬜</span>}
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
        )}
        {f.type === 'habit' && (
          <div className="input-group">
            <label>💡 Perché vuoi fare questa abitudine?</label>
            <textarea rows={2} placeholder="Es. Voglio correre perché voglio vivere sano..." value={f.why} onChange={e => set('why', e.target.value.slice(0, 200))} style={{ resize: 'none' }} />
            <div style={{ fontSize: '0.68em', color: '#444', textAlign: 'right' }}>{f.why.length}/200</div>
          </div>
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
