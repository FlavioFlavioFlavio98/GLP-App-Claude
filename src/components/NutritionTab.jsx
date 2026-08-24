import { useEffect } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import { getCurrentWeight, getProteinGoal, getDayProteinTotal } from '../lib/nutritionStats'
import FoodIcon from './FoodIcon'

function fmtTime(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

export default function NutritionTab({ actions, authUserId, isReadOnly, globalData }) {
  const { state } = useApp()
  const { foods, log } = actions.getProteinData()
  const weightLog = globalData?.weightLog || {}
  const todayStr = toDateString(new Date())
  const viewDate = state.viewDate || todayStr
  const isToday = viewDate === todayStr

  // Popola gli alimenti di partenza al primo utilizzo — no-op se già presenti
  useEffect(() => {
    if (authUserId === 'flavio' && !isReadOnly) actions.ensureDefaultProteinFoods()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const weightKg = getCurrentWeight(weightLog, viewDate)
  const goal = getProteinGoal(weightKg)
  const total = getDayProteinTotal(log, viewDate)
  const dayEntries = [...(log[viewDate] || [])].reverse()
  const progress = goal ? Math.max(0, Math.min(100, Math.round((total / goal) * 100))) : 0
  const reached = goal !== null && total >= goal

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Riepilogo giornaliero */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 14, padding: '16px', marginBottom: 12,
      }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
          🥩 Proteine {isToday ? 'di oggi' : 'del giorno'}
        </div>

        {!weightKg ? (
          <div style={{ fontSize: '0.8em', color: '#EF9F27', marginBottom: 10 }}>
            ⚠️ Nessun peso registrato — vai su Tracciamento Peso per calcolare l'obiettivo
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: '2.4em', fontWeight: 900, color: reached ? 'var(--success, #4caf50)' : 'var(--theme-color)' }}>
                {total}
              </span>
              <span style={{ fontSize: '1.1em', color: '#888', fontWeight: 700 }}>/ {goal}g</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: reached ? 'var(--success, #4caf50)' : 'var(--theme-color)',
                borderRadius: 5, transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '0.68em', color: '#555', textAlign: 'center' }}>
              {reached ? '🎉 Obiettivo raggiunto' : `${progress}% — obiettivo 2g/kg × ${weightKg}kg`}
            </div>
          </>
        )}

        <button
          onClick={() => actions.openModal('proteinEntry')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 14px', marginTop: 14,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--text)',
            fontSize: '0.9em', fontWeight: 700,
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 20 }}>add_circle</span>
          Aggiungi alimento
        </button>

        <button
          onClick={() => actions.openModal('proteinFoodsManage')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 12px', marginTop: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, cursor: 'pointer', color: 'var(--text-sec)',
            fontSize: '0.8em', fontWeight: 600,
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 16 }}>tune</span>
          Gestisci alimenti ({foods.length})
        </button>
      </div>

      {/* Voci di oggi */}
      {dayEntries.length > 0 && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--card-border)',
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
            Registrato {isToday ? 'oggi' : 'quel giorno'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayEntries.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              }}>
                <FoodIcon food={{ name: e.name, emoji: e.emoji }} size={26} style={{ borderRadius: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.name} · {e.grams}g
                  </div>
                  <div style={{ fontSize: '0.62em', color: '#666' }}>{fmtTime(e.time)}</div>
                </div>
                <span style={{ fontSize: '0.85em', fontWeight: 800, color: 'var(--theme-color)', flexShrink: 0 }}>
                  {e.proteinGrams}g
                </span>
                <button
                  className="btn-icon"
                  style={{ padding: 2 }}
                  onClick={async () => {
                    if (!window.confirm(`Eliminare "${e.name}"?`)) return
                    await actions.deleteProteinEntry(viewDate, e.id)
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
