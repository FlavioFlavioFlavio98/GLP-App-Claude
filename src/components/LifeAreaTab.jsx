import { useEffect } from 'react'
import { toDateString } from '../lib/habitLogic'
import { computeLifeAreaStats } from '../lib/lifeAreaStats'
import LifeAreaTimerCard from './LifeAreaTimerCard'

function StatCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

export default function LifeAreaTab({ actions, authUserId, isReadOnly, globalData }) {
  // Popola le 3 aree di esempio al primo utilizzo — no-op se già presenti,
  // stesso principio di ensureDefaultMealContent in MealsTab.
  useEffect(() => {
    if (authUserId === 'flavio' && !isReadOnly) actions.ensureDefaultLifeAreas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lifeAreas = globalData?.lifeAreas || []
  const activeAreas = lifeAreas.filter(a => a.active !== false)
  const lifeAreaLog = globalData?.lifeAreaLog || {}
  const stats = computeLifeAreaStats(lifeAreaLog, lifeAreas)
  const todayStr = toDateString(new Date())
  const todaySessions = (lifeAreaLog[todayStr] || []).slice().sort((a, b) => (b.time || '').localeCompare(a.time || ''))

  function areaFor(areaId) {
    return lifeAreas.find(a => a.id === areaId)
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <h2 style={{ fontSize: '1.1em', fontWeight: 800, marginBottom: 4 }}>🌱 Aree della vita</h2>
      <p style={{ fontSize: '0.78em', color: '#888', marginTop: 0, marginBottom: 16 }}>
        Tempo dedicato a migliorare ciò che conta — non è un'abitudine da ripetere, è crescita che si accumula.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatCell label="Oggi" value={`${stats.todayMinutes}m`} />
        <StatCell label="Settimana" value={`${stats.weekMinutes}m`} />
        <StatCell label="Totale" value={`${stats.lifetimeMinutes}m`} />
        <StatCell label="Streak" value={`${stats.streak}gg`} color={stats.streak > 0 ? 'var(--success)' : undefined} />
      </div>

      {!isReadOnly && <LifeAreaTimerCard areas={lifeAreas} actions={actions} />}

      <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Aree</div>
      {activeAreas.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', padding: '16px 0' }}>Nessuna area ancora — creane una da "Gestisci aree".</p>
      )}
      {activeAreas.map(a => {
        const byArea = stats.byArea.find(x => x.areaId === a.id)
        return (
          <div
            key={a.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
            }}
          >
            <span style={{ fontSize: '1.4em' }}>{a.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{a.name}</div>
              <div style={{ fontSize: '0.72em', color: '#888' }}>{byArea?.todayMin || 0}m oggi · {byArea?.weekMin || 0}m settimana</div>
            </div>
            {!isReadOnly && (
              <button
                className="btn-icon"
                title="Aggiungi sessione"
                onClick={() => actions.openModal('lifeAreaLog', { areaId: a.id })}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '1.1em' }}
              >+</button>
            )}
          </div>
        )
      })}

      {todaySessions.length > 0 && (
        <>
          <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 10px' }}>Sessioni di oggi</div>
          {todaySessions.map(s => {
            const area = areaFor(s.areaId)
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', marginBottom: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
              }}>
                <span style={{ fontSize: '1.1em' }}>{area?.emoji || '❔'}</span>
                <span style={{ fontSize: '0.72em', color: '#666', minWidth: 40 }}>{s.time?.slice(0, 5) || ''}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82em' }}>{area?.name || 'Area rimossa'} · {s.duration} min</div>
                  {s.note && <div style={{ fontSize: '0.7em', color: '#888' }}>{s.note}</div>}
                </div>
                <span style={{ fontSize: '0.75em', color: 'var(--success)', fontWeight: 600 }}>+{s.pts}pt</span>
                {!isReadOnly && (
                  <>
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      title="Modifica durata"
                      onClick={async () => {
                        const val = window.prompt(`Durata in minuti (attuale: ${s.duration}):`, s.duration)
                        if (val === null) return
                        await actions.editLifeAreaSession(todayStr, s.id, s.areaId, val, s.note)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>edit</span>
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      title="Elimina sessione"
                      onClick={async () => {
                        if (!window.confirm(`Eliminare la sessione da ${s.duration} minuti?`)) return
                        await actions.deleteLifeAreaSession(todayStr, s.id)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </>
      )}

      {!isReadOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn-secondary" style={{ flex: 1, padding: 12 }} onClick={() => actions.openModal('lifeAreaLog')}>+ Sessione manuale</button>
          <button className="btn-secondary" style={{ flex: 1, padding: 12 }} onClick={() => actions.openModal('lifeAreaManage')}>⚙️ Gestisci aree</button>
        </div>
      )}
    </div>
  )
}
