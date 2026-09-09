import { useEffect, useRef, useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import { computeLifeAreaStats, computeLifeAreaDailyTotals } from '../lib/lifeAreaStats'
import { Chart } from '../lib/chartSetup'
import LifeAreaTimerCard from './LifeAreaTimerCard'

// Soglia oltre la quale un'area "ferma" merita un avviso in UI — non troppo
// aggressiva (le aree della vita non sono abitudini quotidiane), ma abbastanza
// da farla notare prima che passi una settimana intera senza attenzione.
const NEGLECT_WARNING_DAYS = 4

function fmtDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return ['D', 'L', 'M', 'M', 'G', 'V', 'S'][d.getDay()]
}

function WeeklyTrendChart({ lifeAreaLog }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const dailyTotals = computeLifeAreaDailyTotals(lifeAreaLog, 7)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#ffca28'
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: dailyTotals.map(d => fmtDayLabel(d.date)),
        datasets: [{ data: dailyTotals.map(d => d.totalMin), backgroundColor: themeColor, borderRadius: 3, barPercentage: 0.6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: ctx => `${ctx.raw}m` } } },
        scales: {
          y: { display: false, beginAtZero: true },
          x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dailyTotals)])

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Andamento settimanale</div>
      <div style={{ height: 60, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

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

  // Card ad accordion: un solo tocco sul nome area espande la lista degli
  // "spunti" di quell'area (invece di dover aprire il modal ogni volta) —
  // richiesta esplicita di Flavio per accedervi più in fretta quando ha
  // tempo libero da dedicare a un'area specifica. Un solo accordion aperto
  // alla volta, come una normale lista a fisarmonica.
  const [expandedAreaId, setExpandedAreaId] = useState(null)
  const [sessionsExpanded, setSessionsExpanded] = useState(false)

  const lifeAreas = globalData?.lifeAreas || []
  const lifeAreaLog = globalData?.lifeAreaLog || {}
  const lifeAreaIdeas = globalData?.lifeAreaIdeas || []
  const stats = computeLifeAreaStats(lifeAreaLog, lifeAreas)
  // Più trascurata prima (area mai loggata = massima priorità): la tab deve
  // spingere a riequilibrare, non solo elencare in ordine di creazione.
  const activeAreas = lifeAreas
    .filter(a => a.active !== false)
    .slice()
    .sort((x, y) => {
      const dx = stats.byArea.find(b => b.areaId === x.id)?.daysSinceLastSession
      const dy = stats.byArea.find(b => b.areaId === y.id)?.daysSinceLastSession
      return (dy ?? Infinity) - (dx ?? Infinity)
    })
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

      <WeeklyTrendChart lifeAreaLog={lifeAreaLog} />

      {!isReadOnly && <LifeAreaTimerCard areas={lifeAreas} actions={actions} />}

      <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Aree</div>
      {activeAreas.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', padding: '16px 0' }}>Nessuna area ancora — creane una da "Gestisci aree".</p>
      )}
      {activeAreas.map(a => {
        const byArea = stats.byArea.find(x => x.areaId === a.id)
        const neglected = byArea?.daysSinceLastSession != null && byArea.daysSinceLastSession >= NEGLECT_WARNING_DAYS
        const hasTarget = byArea?.weeklyTargetMin > 0
        const targetPct = hasTarget ? Math.min(100, byArea.weekTargetPct || 0) : 0
        const areaIdeas = lifeAreaIdeas
          .filter(i => i.areaId === a.id)
          .sort((x, y) => (x.done === y.done) ? 0 : (x.done ? 1 : -1))
        const pendingIdeasCount = areaIdeas.filter(i => !i.done).length
        const isExpanded = expandedAreaId === a.id
        return (
          <div
            key={a.id}
            style={{
              padding: '10px 14px', marginBottom: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.4em' }}>{a.emoji}</span>
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer' }}
                onClick={() => setExpandedAreaId(id => id === a.id ? null : a.id)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.name}
                    {neglected && <span title={`Ferma da ${byArea.daysSinceLastSession} giorni`}>⚠️</span>}
                    {pendingIdeasCount > 0 && (
                      <span style={{ fontSize: '0.62em', fontWeight: 800, color: '#000', background: 'var(--theme-color)', borderRadius: 8, padding: '1px 6px' }}>
                        💡{pendingIdeasCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72em', color: neglected ? '#f2994a' : '#888' }}>
                    {byArea?.todayMin || 0}m oggi · {byArea?.weekMin || 0}m settimana
                    {neglected && ` · ferma da ${byArea.daysSinceLastSession}g`}
                  </div>
                </div>
                <span className="material-icons-round" style={{ fontSize: 20, color: '#666', flexShrink: 0 }}>
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-icon"
                    title="Diario"
                    onClick={() => actions.openModal('lifeAreaDetail', { areaId: a.id })}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '1em' }}
                  >📓</button>
                  <button
                    className="btn-icon"
                    title="Aggiungi sessione"
                    onClick={() => actions.openModal('lifeAreaLog', { areaId: a.id })}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '1.1em' }}
                  >+</button>
                </div>
              )}
            </div>
            {hasTarget && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${targetPct}%`, borderRadius: 3,
                    background: byArea.weekTargetPct >= 100 ? 'var(--success)' : (a.color || 'var(--theme-color)'),
                  }} />
                </div>
                <div style={{ fontSize: '0.65em', color: '#666', marginTop: 4 }}>
                  {byArea.weekMin}/{byArea.weeklyTargetMin} min obiettivo{byArea.weekTargetPct >= 100 ? ' 🎉' : ''}
                </div>
              </div>
            )}
            {isExpanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {areaIdeas.length === 0 ? (
                  <p style={{ fontSize: '0.76em', color: '#666', margin: '0 0 8px' }}>Ancora nessuno spunto qui.</p>
                ) : (
                  areaIdeas.map(i => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <button
                        className="btn-icon"
                        style={{ padding: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        onClick={() => actions.toggleLifeAreaIdea(i.id)}
                      >
                        <span className="material-icons-round" style={{ fontSize: 18, color: i.done ? 'var(--success)' : '#666' }}>
                          {i.done ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                      </button>
                      <span style={{ flex: 1, fontSize: '0.82em', textDecoration: i.done ? 'line-through' : 'none', opacity: i.done ? 0.5 : 1 }}>{i.text}</span>
                    </div>
                  ))
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => actions.openModal('lifeAreaDetail', { areaId: a.id })}
                    style={{ background: 'none', border: 'none', color: 'var(--theme-color)', fontSize: '0.76em', fontWeight: 700, cursor: 'pointer', padding: '4px 0 0' }}
                  >Gestisci spunti →</button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {todaySessions.length > 0 && (
        <>
          <button
            onClick={() => setSessionsExpanded(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: '16px 0 6px' }}
          >
            <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Sessioni di oggi ({todaySessions.length})</span>
            <span className="material-icons-round" style={{ fontSize: 16, color: '#666' }}>{sessionsExpanded ? 'expand_less' : 'expand_more'}</span>
          </button>
          {sessionsExpanded && todaySessions.map(s => {
            const area = areaFor(s.areaId)
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', marginBottom: 4,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              }}>
                <span style={{ fontSize: '0.95em' }}>{area?.emoji || '❔'}</span>
                <span style={{ fontSize: '0.68em', color: '#666', minWidth: 36 }}>{s.time?.slice(0, 5) || ''}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area?.name || 'Area rimossa'} · {s.duration} min</div>
                  {s.note && <div style={{ fontSize: '0.66em', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.note}</div>}
                </div>
                <span style={{ fontSize: '0.72em', color: 'var(--success)', fontWeight: 600 }}>+{s.pts}pt</span>
                {!isReadOnly && (
                  <>
                    <button
                      className="btn-icon"
                      style={{ padding: 1 }}
                      title="Modifica durata"
                      onClick={async () => {
                        const val = window.prompt(`Durata in minuti (attuale: ${s.duration}):`, s.duration)
                        if (val === null) return
                        await actions.editLifeAreaSession(todayStr, s.id, s.areaId, val, s.note)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 14, color: '#555' }}>edit</span>
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: 1 }}
                      title="Elimina sessione"
                      onClick={async () => {
                        if (!window.confirm(`Eliminare la sessione da ${s.duration} minuti?`)) return
                        await actions.deleteLifeAreaSession(todayStr, s.id)
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 14, color: '#555' }}>delete</span>
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
          <button
            onClick={() => actions.openModal('lifeAreaLog')}
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontWeight: 700, fontSize: '0.88em', cursor: 'pointer' }}
          >+ Sessione manuale</button>
          <button
            onClick={() => actions.openModal('lifeAreaManage')}
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontWeight: 700, fontSize: '0.88em', cursor: 'pointer' }}
          >⚙️ Gestisci aree</button>
        </div>
      )}
    </div>
  )
}
