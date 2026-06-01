import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import RewardCategoryPicker from './RewardCategoryPicker'

const today = () => toDateString(new Date())

const DEFAULT = {
  itemType: 'habit',
  habitMode: 'normal',   // 'normal' | 'multi' | 'numeric' | 'goal'
  importance: 'medium',
  timeSlot: null,
  why: '',
  recurMode: 'recur',
  name: '', categoryId: '', desc: '', tagId: '',
  startDate: today(),
  reward: '', penalty: '', rewardMin: '',
  frequency: '1', targetDate: today(),
  cost: '',
  // numeric config
  unit: '', inputType: 'integer',
  threshold: '', belowThreshold: 'zero', penaltyFixed: '',
  pointsPerUnit: '', unitSize: '1000', cap: '',
  // goal config
  goalTarget: '', goalUnit: '', goalDeadline: '', goalReward: '', goalPenalty: '',
}

function NumericConfigForm({ f, set }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Configurazione Numerica</div>

      <div className="grid-2">
        <div className="input-group">
          <label>Unità di misura</label>
          <input type="text" placeholder="es. passi, km, ore" value={f.unit} onChange={e => set('unit', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Tipo input</label>
          <div className="switch-group" style={{ marginTop: 6 }}>
            <div className={`switch-opt${f.inputType === 'integer' ? ' active' : ''}`} onClick={() => set('inputType', 'integer')}>Intero</div>
            <div className={`switch-opt${f.inputType === 'decimal' ? ' active' : ''}`} onClick={() => set('inputType', 'decimal')}>Decimale</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="input-group">
          <label>Punti per unità</label>
          <input type="number" step="0.01" placeholder="es. 0.2" value={f.pointsPerUnit} onChange={e => set('pointsPerUnit', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Per ogni (quantità)</label>
          <input type="number" placeholder="es. 1000" value={f.unitSize} onChange={e => set('unitSize', e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: '0.68em', color: '#555', marginBottom: 10 }}>
        Formula: {f.pointsPerUnit || '?'} pt ogni {f.unitSize || '?'} {f.unit || 'unità'}
      </div>

      <div className="grid-2">
        <div className="input-group">
          <label>Soglia minima</label>
          <input type="number" placeholder="sotto cui si applica regola" value={f.threshold} onChange={e => set('threshold', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Cap massimo pt (0 = nessun limite)</label>
          <input type="number" placeholder="es. 10" value={f.cap} onChange={e => set('cap', e.target.value)} />
        </div>
      </div>

      <div className="input-group">
        <label>Sotto soglia</label>
        <div className="switch-group" style={{ marginTop: 6 }}>
          <div className={`switch-opt${f.belowThreshold === 'zero' ? ' active' : ''}`} onClick={() => set('belowThreshold', 'zero')}>0 pt</div>
          <div className={`switch-opt${f.belowThreshold === 'fixed' ? ' active' : ''}`} onClick={() => set('belowThreshold', 'fixed')}>Penalità fissa</div>
          <div className={`switch-opt${f.belowThreshold === 'proportional' ? ' active' : ''}`} onClick={() => set('belowThreshold', 'proportional')}>Proporzionale</div>
        </div>
      </div>
      {f.belowThreshold === 'fixed' && (
        <div className="input-group">
          <label>Penalità fissa (pt)</label>
          <input type="number" placeholder="es. 5" value={f.penaltyFixed} onChange={e => set('penaltyFixed', e.target.value)} />
        </div>
      )}
    </div>
  )
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
      const isGoal = f.habitMode === 'goal'
      if (isGoal) {
        const habit = {
          id, name: f.name, tagId: f.tagId || '', description: f.desc || '',
          type: 'goal',
          reward: 0, penalty: 0, isMulti: false, rewardMin: 0,
          timeSlot: null, why: null, numericType: null, numericConfig: null,
          goalConfig: {
            targetValue: parseFloat(f.goalTarget) || 1,
            currentValue: 0,
            unit: f.goalUnit || '',
            deadline: f.goalDeadline || '',
            rewardOnComplete: parseInt(f.goalReward) || 0,
            penaltyOnFail: parseInt(f.goalPenalty) || 0,
          },
          changes: [{ date: startDate, reward: 0, penalty: 0, isMulti: false, rewardMin: 0, description: f.desc, note: 'Creazione Obiettivo' }],
        }
        await actions.addItem(habit, 'habit')
        setF(DEFAULT)
        actions.closeModal()
        return
      }

      const isNumeric = f.habitMode === 'numeric'
      const isMulti = f.habitMode === 'multi'
      const r = parseInt(f.reward) || 0
      const p = f.recurMode === 'if' ? 0 : (parseInt(f.penalty) || 0)
      const freq = f.recurMode === 'if' ? 1 : parseInt(f.frequency)
      const rMin = parseInt(f.rewardMin) || 0

      const numericConfig = isNumeric ? {
        unit: f.unit || '',
        inputType: f.inputType || 'integer',
        threshold: parseFloat(f.threshold) || 0,
        belowThreshold: f.belowThreshold || 'zero',
        penaltyFixed: parseFloat(f.penaltyFixed) || 0,
        pointsPerUnit: parseFloat(f.pointsPerUnit) || 0,
        unitSize: parseFloat(f.unitSize) || 1000,
        cap: parseFloat(f.cap) || null,
      } : null

      const habit = {
        id, name: f.name, tagId: f.tagId || '',
        reward: isNumeric ? 0 : r,
        penalty: isNumeric ? 0 : p,
        type: f.recurMode,
        isMulti: isMulti,
        rewardMin: isMulti ? rMin : 0,
        description: f.desc || '',
        importance: f.importance || 'medium',
        timeSlot: f.timeSlot || null,
        why: f.why?.trim() || null,
        numericType: isNumeric || null,
        numericConfig,
        changes: [{
          date: startDate,
          reward: isNumeric ? 0 : r,
          penalty: isNumeric ? 0 : p,
          isMulti,
          rewardMin: isMulti ? rMin : 0,
          description: f.desc,
          note: 'Creazione Iniziale',
        }],
      }
      if (f.recurMode === 'recur') habit.frequency = freq
      else if (f.recurMode === 'single') habit.targetDate = f.targetDate
      await actions.addItem(habit, 'habit')
    } else {
      const c = parseInt(f.cost) || 0
      await actions.addItem({
        id, name: f.name, cost: c, tagId: f.tagId,
        categoryId: f.categoryId || '', description: f.desc,
        changes: [{ date: startDate, cost: c, note: 'Creazione Iniziale' }],
      }, 'reward')
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
            {/* Importance */}
            {f.habitMode !== 'goal' && (
              <div className="input-group">
                <label>Importanza</label>
                <div className="switch-group" style={{ marginTop: 4 }}>
                  {[
                    { v: 'low',    icon: '🔵', label: 'Bassa' },
                    { v: 'medium', icon: '🟡', label: 'Media' },
                    { v: 'high',   icon: '🔴', label: 'Alta' },
                  ].map(opt => (
                    <div key={opt.v} className={`switch-opt${f.importance === opt.v ? ' active' : ''}`} onClick={() => set('importance', opt.v)}>
                      {opt.icon} {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habit mode selector */}
            <div className="input-group">
              <label>Tipo Abitudine</label>
              <div className="switch-group" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                <div className={`switch-opt${f.habitMode === 'normal' ? ' active' : ''}`} onClick={() => set('habitMode', 'normal')}>Normale</div>
                <div className={`switch-opt${f.habitMode === 'multi' ? ' active' : ''}`} onClick={() => set('habitMode', 'multi')}>Multi</div>
                <div className={`switch-opt${f.habitMode === 'numeric' ? ' active' : ''}`} onClick={() => set('habitMode', 'numeric')}>Numerica</div>
                <div className={`switch-opt${f.habitMode === 'goal' ? ' active' : ''}`} onClick={() => set('habitMode', 'goal')}>Obiettivo</div>
              </div>
            </div>

            {/* Goal config */}
            {f.habitMode === 'goal' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginTop: 8 }}>
                <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Configurazione Obiettivo</div>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Valore target</label>
                    <input type="number" placeholder="es. 12" value={f.goalTarget} onChange={e => set('goalTarget', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Unità</label>
                    <input type="text" placeholder="es. libri, km" value={f.goalUnit} onChange={e => set('goalUnit', e.target.value)} />
                  </div>
                </div>
                <div className="input-group">
                  <label>Scadenza</label>
                  <input type="date" value={f.goalDeadline} onChange={e => set('goalDeadline', e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Bonus al completamento (pt)</label>
                    <input type="number" placeholder="es. 500" value={f.goalReward} onChange={e => set('goalReward', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Penalità se scade (pt)</label>
                    <input type="number" placeholder="es. 100" value={f.goalPenalty} onChange={e => set('goalPenalty', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Numeric config */}
            {f.habitMode === 'numeric' && <NumericConfigForm f={f} set={set} />}

            {/* Normal/multi fields — hidden for goal and numeric */}
            {f.habitMode !== 'numeric' && f.habitMode !== 'goal' && (
              <>
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
                    <label>{f.habitMode === 'multi' ? 'Reward (Max)' : 'Reward'}</label>
                    <input type="number" placeholder="+" value={f.reward} onChange={e => set('reward', e.target.value)} />
                  </div>
                  {f.recurMode !== 'if' && (
                    <div className="input-group">
                      <label>Penalità</label>
                      <input type="number" placeholder="-" value={f.penalty} onChange={e => set('penalty', e.target.value)} />
                    </div>
                  )}
                </div>
                {f.habitMode === 'multi' && (
                  <div className="input-group" style={{ borderTop: '1px solid #333', paddingTop: 5 }}>
                    <label style={{ color: 'var(--theme-color)' }}>Reward Minimo (Min)</label>
                    <input type="number" placeholder="Punti Minimi" value={f.rewardMin} onChange={e => set('rewardMin', e.target.value)} />
                  </div>
                )}
              </>
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

        {/* Fascia oraria + "Perché lo fai" — solo per abitudini */}
        {f.itemType === 'habit' && f.habitMode !== 'goal' && (
          <div className="input-group" style={{ marginTop: 12 }}>
            <label>Fascia oraria (opzionale)</label>
            <div className="switch-group" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              {[
                { v: null, icon: '⬜', label: 'Nessuna' },
                { v: 'morning', icon: '🌅', label: 'Mattina' },
                { v: 'afternoon', icon: '☀️', label: 'Pomeriggio' },
                { v: 'evening', icon: '🌙', label: 'Sera' },
              ].map(opt => (
                <div key={String(opt.v)} className={`switch-opt${f.timeSlot === opt.v ? ' active' : ''}`} onClick={() => set('timeSlot', opt.v)}>
                  {opt.icon} {opt.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {f.itemType === 'habit' && f.habitMode !== 'goal' && (
          <div className="input-group" style={{ marginTop: 16 }}>
            <label>💡 Perché vuoi fare questa abitudine? (opzionale)</label>
            <textarea
              rows={3}
              placeholder="Es. Voglio correre perché voglio vivere sano fino a 90 anni..."
              value={f.why}
              onChange={e => set('why', e.target.value.slice(0, 200))}
              style={{ resize: 'none' }}
            />
            <div style={{ fontSize: '0.68em', color: '#444', textAlign: 'right' }}>{f.why.length}/200</div>
          </div>
        )}

        <button className="btn-main" onClick={handleSave}>Salva</button>
        <button className="btn-sec" onClick={() => { setF(DEFAULT); actions.closeModal() }}>Chiudi</button>
      </div>
    </div>
  )
}
