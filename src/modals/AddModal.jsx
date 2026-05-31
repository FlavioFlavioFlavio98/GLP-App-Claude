import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import RewardCategoryPicker from './RewardCategoryPicker'

const today = () => toDateString(new Date())

const DEFAULT = {
  itemType: 'habit',
  recurMode: 'recur',
  name: '',
  categoryId: '',
  desc: '',
  tagId: '',
  startDate: today(),
  reward: '',
  penalty: '',
  rewardMin: '',
  frequency: '1',
  targetDate: today(),
  cost: '',
  isMulti: false,
}

export default function AddModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [f, setF] = useState(DEFAULT)

  if (modal !== 'add') return null

  function set(key, val) { setF(prev => ({ ...prev, [key]: val })) }

  async function handleSave() {
    if (!f.name.trim()) { actions.vibrate('heavy'); return }
    const id = Date.now().toString()
    const startDate = f.startDate || today()
    if (f.itemType === 'habit') {
      const r = parseInt(f.reward) || 0
      const p = f.recurMode === 'if' ? 0 : (parseInt(f.penalty) || 0)
      const freq = f.recurMode === 'if' ? 1 : parseInt(f.frequency)
      const rMin = parseInt(f.rewardMin) || 0
      const habit = {
        id, name: f.name, tagId: f.tagId,
        reward: r, penalty: p, type: f.recurMode,
        isMulti: f.isMulti, rewardMin: rMin, description: f.desc,
        changes: [{ date: startDate, reward: r, penalty: p, isMulti: f.isMulti, rewardMin: rMin, description: f.desc, note: 'Creazione Iniziale' }],
      }
      if (f.recurMode === 'recur') habit.frequency = freq
      else if (f.recurMode === 'single') habit.targetDate = f.targetDate
      await actions.addItem(habit, 'habit')
    } else {
      const c = parseInt(f.cost) || 0
      await actions.addItem({ id, name: f.name, cost: c, tagId: f.tagId, categoryId: f.categoryId || '', description: f.desc, changes: [{ date: startDate, cost: c, note: 'Creazione Iniziale' }] }, 'reward')
    }
    setF(DEFAULT)
    actions.closeModal()
  }

  const tags = globalData?.tags || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box">
        <h3>Nuovo Elemento</h3>

        <div className="input-group">
          <label>Data Inizio / Creazione</label>
          <input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} style={{ color: 'var(--theme-color)', fontWeight: 'bold' }} />
        </div>

        <div className="switch-group">
          <div className={`switch-opt${f.itemType === 'habit' ? ' active' : ''}`} onClick={() => set('itemType', 'habit')}>Abitudine</div>
          <div className={`switch-opt${f.itemType === 'reward' ? ' active' : ''}`} onClick={() => set('itemType', 'reward')}>Premio</div>
        </div>

        <input type="text" placeholder="Nome" value={f.name} onChange={e => set('name', e.target.value)} />
        <select value={f.tagId} onChange={e => set('tagId', e.target.value)}>
          <option value="">Nessun Tag</option>
          {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="text" placeholder="Descrizione (opzionale)" value={f.desc} onChange={e => set('desc', e.target.value)} />

        {f.itemType === 'habit' && (
          <>
            <div style={{ margin: '15px 0', display: 'flex', alignItems: 'center', gap: 10, background: '#2a2a2a', padding: 10, borderRadius: 8 }}>
              <input type="checkbox" id="newIsMulti" style={{ width: 20, height: 20, margin: 0 }} checked={f.isMulti} onChange={e => set('isMulti', e.target.checked)} />
              <label htmlFor="newIsMulti" style={{ fontSize: '0.9em', margin: 0 }}>Abilita livelli Min/Max?</label>
            </div>

            <div className="switch-group">
              {['recur', 'single', 'if'].map(m => (
                <div key={m} className={`switch-opt${f.recurMode === m ? ' active' : ''}`} onClick={() => set('recurMode', m)}>
                  {m === 'recur' ? 'Ricorr.' : m === 'single' ? 'Singolo' : 'If (Bonus)'}
                </div>
              ))}
            </div>

            {f.recurMode === 'recur' && (
              <select value={f.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="1">Ogni Giorno</option>
                <option value="3">Ogni 3 Giorni</option>
                <option value="7">Settimanale</option>
                <option value="30">Mensile</option>
              </select>
            )}
            {f.recurMode === 'single' && (
              <input type="date" value={f.targetDate} onChange={e => set('targetDate', e.target.value)} />
            )}

            <div className="grid-2">
              <div className="input-group">
                <label>{f.isMulti ? 'Reward (Max)' : 'Reward'}</label>
                <input type="number" placeholder="+" value={f.reward} onChange={e => set('reward', e.target.value)} />
              </div>
              {f.recurMode !== 'if' && (
                <div className="input-group">
                  <label>Penalità</label>
                  <input type="number" placeholder="-" value={f.penalty} onChange={e => set('penalty', e.target.value)} />
                </div>
              )}
            </div>
            {f.isMulti && (
              <div className="input-group" style={{ borderTop: '1px solid #333', paddingTop: 5 }}>
                <label style={{ color: 'var(--theme-color)' }}>Reward Minimo (Min)</label>
                <input type="number" placeholder="Punti Minimi" value={f.rewardMin} onChange={e => set('rewardMin', e.target.value)} />
              </div>
            )}
          </>
        )}

        {f.itemType === 'reward' && (
          <>
            <input type="number" placeholder="Costo" value={f.cost} onChange={e => set('cost', e.target.value)} />
            <RewardCategoryPicker
              categories={globalData?.rewardCategories || []}
              value={f.categoryId || ''}
              onChange={v => set('categoryId', v)}
            />
          </>
        )}

        <button className="btn-main" onClick={handleSave}>Salva</button>
        <button className="btn-sec" onClick={() => { setF(DEFAULT); actions.closeModal() }}>Chiudi</button>
      </div>
    </div>
  )
}
