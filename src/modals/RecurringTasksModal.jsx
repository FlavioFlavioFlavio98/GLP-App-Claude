import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/taskColors'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box',
}
const labelStyle = { fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }

export default function RecurringTasksModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [reward, setReward] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [intervalDays, setIntervalDays] = useState(1)
  const [startDate, setStartDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)

  if (modal !== 'recurringTasks') return null

  const recurringTasks = globalData?.recurringTasks || []

  function resetForm() {
    setTitle(''); setPriority('medium'); setReward(0); setPenalty(0)
    setIntervalDays(1); setStartDate(toDateString(new Date())); setShowForm(false)
  }

  async function handleAdd() {
    if (!title.trim()) { actions.showToast('Scrivi un titolo', '⚠️'); return }
    setSaving(true)
    await actions.addRecurringTask({ title, priority, reward, penalty, intervalDays, startDate })
    setSaving(false)
    resetForm()
  }

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

        <div style={{ textAlign: 'center', fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          🔁 Task ricorrenti
        </div>
        <div style={{ fontSize: '0.75em', color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
          Ogni volta che completi una ricorrente (anche in ritardo), la prossima viene generata automaticamente dopo N giorni dal completamento — non da un calendario fisso.
        </div>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', marginBottom: 16,
              background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12, cursor: 'pointer', color: 'var(--text)', fontSize: '0.9em', fontWeight: 700,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 20 }}>add_circle</span>
            Nuova ricorrente
          </button>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Cosa</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Controllo pressione" autoFocus style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Ogni quanti giorni</div>
              <input type="number" min="1" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} style={inputStyle} />
              <div style={{ fontSize: '0.68em', color: '#666', marginTop: 4 }}>
                {parseInt(intervalDays) === 1 ? 'Tutti i giorni' : `Ogni ${intervalDays} giorni`}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Priorità</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['high', 'medium', 'low'].map(p => {
                  const c = PRIORITY_COLORS[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                        background: priority === p ? `${c}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${priority === p ? c : 'rgba(255,255,255,0.1)'}`,
                        color: priority === p ? c : '#666', fontSize: '0.75em', fontWeight: 700,
                      }}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Ricompensa</div>
                <input type="number" min="0" value={reward} onChange={e => setReward(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Penalità</div>
                <input type="number" min="0" value={penalty} onChange={e => setPenalty(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Prima scadenza</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-main" style={{ flex: 1, padding: '11px', margin: 0 }} onClick={handleAdd} disabled={saving}>
                {saving ? '⏳...' : 'Crea'}
              </button>
              <button className="btn-sec" style={{ flex: 1, padding: '11px', margin: 0 }} onClick={resetForm}>Annulla</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recurringTasks.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
              opacity: r.active === false ? 0.5 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88em', fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: '0.68em', color: '#666' }}>
                  {r.intervalDays === 1 ? 'ogni giorno' : `ogni ${r.intervalDays} giorni`} · +{r.reward}pt / -{r.penalty}pt
                </div>
              </div>
              <button className="btn-icon" style={{ padding: 4 }} onClick={() => actions.toggleRecurringTaskActive(r.id, r.active === false)}>
                <span className="material-icons-round" style={{ fontSize: 18, color: '#888' }}>
                  {r.active === false ? 'play_arrow' : 'pause'}
                </span>
              </button>
              <button
                className="btn-icon"
                style={{ padding: 4 }}
                onClick={async () => {
                  if (!window.confirm(`Eliminare la ricorrenza "${r.title}"? Le task già generate restano.`)) return
                  await actions.deleteRecurringTask(r.id)
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 16, color: '#444' }}>delete</span>
              </button>
            </div>
          ))}
          {recurringTasks.length === 0 && !showForm && (
            <div style={{ fontSize: '0.8em', color: '#888', textAlign: 'center', padding: '12px 0' }}>
              Nessuna task ricorrente ancora
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
