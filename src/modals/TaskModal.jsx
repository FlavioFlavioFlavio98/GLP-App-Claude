import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const PRESETS = [1, 2, 3, 4, 5]

function CoinPicker({ label, value, onChange }) {
  const [customMode, setCustomMode] = useState(false)
  const [customVal, setCustomVal] = useState('')

  useEffect(() => {
    if (!PRESETS.includes(value)) {
      setCustomMode(true)
      setCustomVal(String(value))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectPreset(v) {
    setCustomMode(false)
    onChange(v)
  }

  function activateCustom() {
    setCustomMode(true)
    setCustomVal(String(value))
  }

  function onCustomChange(v) {
    setCustomVal(v)
    const n = parseInt(v)
    if (!isNaN(n) && n >= 0) onChange(n)
  }

  const isPreset = PRESETS.includes(value)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map(p => (
          <button key={p} onClick={() => selectPreset(p)} style={presetBtn(!customMode && value === p)}>
            {p}
          </button>
        ))}
        {customMode ? (
          <input
            type="number" min="0" value={customVal}
            onChange={e => onCustomChange(e.target.value)}
            style={{
              width: 64, padding: '5px 8px', borderRadius: 8,
              border: '1px solid var(--theme-color)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
              fontSize: '0.88em', textAlign: 'center',
            }}
            autoFocus
          />
        ) : (
          <button onClick={activateCustom} style={presetBtn(!isPreset)}>
            {!isPreset ? `${value} ✎` : 'custom'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function TaskModal() {
  const { state, actions } = useApp()
  const { modal, modalPayload } = state
  const isEdit = modal === 'taskEdit'
  const isOpen = modal === 'taskAdd' || isEdit
  if (!isOpen) return null

  const editTask = isEdit ? modalPayload?.task : null

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [deadline, setDeadline] = useState(tomorrow())
  const [reward, setReward] = useState(5)
  const [penalty, setPenalty] = useState(3)
  const [priority, setPriority] = useState('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit && editTask) {
      setTitle(editTask.title || '')
      setDesc(editTask.description || '')
      setDeadline(editTask.deadline || tomorrow())
      setReward(editTask.reward ?? 5)
      setPenalty(editTask.penalty ?? 3)
      setPriority(editTask.priority || 'medium')
    } else {
      setTitle(''); setDesc(''); setDeadline(tomorrow())
      setReward(5); setPenalty(3); setPriority('medium')
    }
    setSaving(false)
  }, [modal]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!title.trim()) { actions.showToast('Inserisci un nome', '⚠️'); return }
    if (!deadline) { actions.showToast('Seleziona una scadenza', '⚠️'); return }
    if (reward < 0 || penalty < 0) { actions.showToast('I punti non possono essere negativi', '⚠️'); return }
    setSaving(true)
    if (isEdit) {
      await actions.editTask({ ...editTask, title: title.trim(), description: desc.trim(), deadline, reward, penalty, priority })
    } else {
      await actions.addTask({ title: title.trim(), description: desc.trim(), deadline, reward, penalty, priority })
    }
    setSaving(false)
    actions.closeModal()
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 44px',
        border: '1px solid var(--card-border)',
        animation: 'slideUp 0.22s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ fontSize: '1em', fontWeight: 700, color: 'var(--text)', marginBottom: 20, textAlign: 'center' }}>
          {isEdit ? '✏️ Modifica Task' : '📋 Nuova Task'}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>NOME TASK *</div>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Es. Studia per l'esame..."
            style={inputStyle}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>DESCRIZIONE (opzionale)</div>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Dettagli..."
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>DATA SCADENZA *</div>
          <input
            type="date" value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>

        <CoinPicker
          label="🪙 COIN SE COMPLETI IN TEMPO *"
          value={reward}
          onChange={setReward}
        />

        <CoinPicker
          label="💀 COIN PERSE SE SCADE *"
          value={penalty}
          onChange={setPenalty}
        />

        <div style={{ marginBottom: 22 }}>
          <div style={labelStyle}>PRIORITÀ *</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              ['high', '● Alta', '#e53935'],
              ['medium', '● Media', '#ff7043'],
              ['low', '● Bassa', '#42a5f5'],
            ].map(([v, l, c]) => (
              <button
                key={v}
                onClick={() => setPriority(v)}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10,
                  cursor: 'pointer', fontSize: '0.82em', fontWeight: 600,
                  background: priority === v ? `${c}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${priority === v ? c : 'rgba(255,255,255,0.1)'}`,
                  color: priority === v ? c : '#666',
                  transition: 'all 0.15s',
                }}
              >{l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => actions.closeModal()}
            style={{
              flex: 1, padding: 13, borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#888', cursor: 'pointer', fontSize: '0.9em',
            }}
          >Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-main"
            style={{ flex: 2, padding: 13, fontSize: '0.95em' }}
          >
            {saving ? '⏳ Salvataggio...' : isEdit ? 'Salva modifiche' : 'Crea Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function presetBtn(active) {
  return {
    minWidth: 36, height: 36, borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--theme-color)' : '#888',
    fontWeight: 700, fontSize: '0.88em', padding: '0 10px',
    transition: 'all 0.15s',
  }
}

const labelStyle = {
  fontSize: '0.72em', fontWeight: 700, color: '#666',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box',
}
