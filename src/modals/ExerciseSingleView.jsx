import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'
import { computeAllStats, getDaysSinceLastRecord } from '../lib/workoutStats'

// ─── Milestones ───────────────────────────────────────────────────────────────

const MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]

function getMilestoneInfo(total) {
  const reached = MILESTONES.filter(m => total >= m)
  const lastReached = reached.at(-1) ?? null
  const next = MILESTONES.find(m => total < m) ?? null
  const base = lastReached ?? 0
  const progress = next ? (total - base) / (next - base) : 1
  return { lastReached, next, progress: Math.min(1, Math.max(0, progress)), remaining: next ? next - total : 0 }
}

// ─── Fun motivational conversion ──────────────────────────────────────────────

function getFunFact(name, totalReps) {
  if (totalReps < 50) return null
  const n = (name || '').toLowerCase()
  let kcal
  if (n.includes('flessioni') || n.includes('push'))   kcal = totalReps * 0.50
  else if (n.includes('squat'))                         kcal = totalReps * 0.60
  else if (n.includes('affondi') || n.includes('lunge'))kcal = totalReps * 0.55
  else if (n.includes('addomin') || n.includes('crunch'))kcal = totalReps * 0.25
  else if (n.includes('pull') || n.includes('trazion')) kcal = totalReps * 0.55
  else                                                  kcal = totalReps * 0.35
  kcal = Math.round(kcal)
  if (kcal >= 3000) return { text: `circa ${Math.round(kcal / 900)} kg di grassi`, icon: '🔥' }
  if (kcal >= 600)  return { text: `circa ${Math.round(kcal / 300)} pizze margherita in kcal`, icon: '🍕' }
  if (kcal >= 150)  return { text: `circa ${Math.round(kcal / 60)} km di corsa in energia`, icon: '🏃' }
  return { text: `circa ${kcal} kcal totali`, icon: '⚡' }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
function fmtDate(d) {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${parseInt(dd)} ${MONTHS[parseInt(m) - 1]} ${y}`
}

function fmtNum(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, big }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 12, padding: big ? '14px 12px' : '10px 12px',
      textAlign: 'center', flex: 1,
    }}>
      <div style={{ fontSize: big ? '1.7em' : '1.25em', fontWeight: 900, color: color || 'var(--theme-color)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.62em', color: '#666', marginTop: 3 }}>{sub}</div>}
      <div style={{ fontSize: '0.58em', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 5 }}>{label}</div>
    </div>
  )
}

function DeltaBadge({ delta }) {
  if (delta === null) return <span style={{ fontSize: '0.7em', color: '#555' }}>nessun dato periodo prec.</span>
  const up = delta >= 0
  return (
    <span style={{ fontSize: '0.72em', fontWeight: 700, color: up ? '#4caf50' : '#e53935' }}>
      {up ? '▲' : '▼'} {Math.abs(delta)}% vs periodo prec.
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExerciseSingleView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, allUsersData, authUserId } = state

  const [chartDays, setChartDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  if (modal !== 'exerciseSingle') return null
  if (authUserId !== 'flavio') return null

  const gd = allUsersData?.flavio
  const exerciseId = modalPayload?.exerciseId
  const exercise = (gd?.quickExercises || []).find(e => e.id === exerciseId)
  if (!exercise) return null

  const exerciseLog = gd?.exerciseLog || {}

  const stats = useMemo(
    () => computeAllStats(exerciseLog, exerciseId),
    [exerciseLog, exerciseId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const recordFreshness = useMemo(
    () => getDaysSinceLastRecord(exerciseLog, exerciseId),
    [exerciseLog, exerciseId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const milestone = getMilestoneInfo(stats.lifetimeReps)
  const funFact = getFunFact(exercise.name, stats.lifetimeReps)

  // ── Chart ──
  const chartDates = useMemo(() => {
    const dates = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      dates.push(toDateString(d))
    }
    return dates
  }, [chartDays])

  const chartData = useMemo(() =>
    chartDates.map(d =>
      (exerciseLog[d] || []).filter(s => s.exerciseId === exerciseId).reduce((a, s) => a + s.reps, 0)
    ),
    [chartDates, exerciseLog, exerciseId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#ffca28'
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: chartDates.map(d => { const [,m,dd] = d.split('-'); return `${parseInt(dd)}/${parseInt(m)}` }),
        datasets: [{
          data: chartData,
          backgroundColor: themeColor,
          borderRadius: 3, barPercentage: 0.7,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', stepSize: 10 } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [chartDates, chartData])

  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  const sectionLabel = (text) => (
    <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8, marginTop: 18 }}>{text}</div>
  )

  return (
    <div className="single-habit-view">
      {/* Header */}
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', flex: 1 }}>
          {exercise.emoji} {exercise.name}
        </h1>
        <button
          className="btn-icon"
          onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('quickExercise'), 60) }}
          title="Aggiungi sessione"
        >
          <span className="material-icons-round" style={{ fontSize: 22 }}>add_circle</span>
        </button>
      </div>

      <div className="single-habit-body">

        {/* ── HERO: totale lifetime ── */}
        <div style={{
          textAlign: 'center', padding: '20px 12px 14px',
          background: 'var(--theme-glow)', borderRadius: 16,
          border: '1px solid var(--theme-color)', marginBottom: 4,
        }}>
          <div style={{ fontSize: '0.62em', color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
            Totale storico · {stats.lifetimeSessions} sessioni
          </div>
          <div style={{ fontSize: '3.6em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1 }}>
            {fmtNum(stats.lifetimeReps)}
          </div>
          <div style={{ fontSize: '0.78em', color: '#888', marginTop: 4 }}>
            ripetizioni di {exercise.name.toLowerCase()}
          </div>
          {funFact && (
            <div style={{ marginTop: 10, fontSize: '0.72em', color: 'var(--text-sec)', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px' }}>
              {funFact.icon} Bruciato {funFact.text} <span style={{ opacity: 0.5 }}>(stima)*</span>
            </div>
          )}
        </div>

        {/* ── NEW RECORD badge ── */}
        {stats.isNewRecord && (
          <div style={{
            margin: '10px 0', padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(255,202,40,0.15), rgba(255,112,67,0.1))',
            border: '2px solid var(--theme-color)',
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.4em' }}>🏆</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88em', color: 'var(--theme-color)' }}>Nuovo record personale!</div>
              <div style={{ fontSize: '0.68em', color: '#888' }}>Hai superato il tuo record con {stats.bestSessionReps} reps</div>
            </div>
          </div>
        )}

        {/* ── MILESTONE ── */}
        {sectionLabel('🏆 Milestone')}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px' }}>
          {milestone.lastReached ? (
            <div style={{ fontWeight: 700, fontSize: '0.88em', color: 'var(--theme-color)', marginBottom: 6 }}>
              🥇 Club delle {milestone.lastReached.toLocaleString()} rip. — raggiunto!
            </div>
          ) : (
            <div style={{ fontSize: '0.8em', color: '#555', marginBottom: 6 }}>Prossima milestone: {MILESTONES[0]} rip.</div>
          )}
          {milestone.next && (
            <>
              <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 6 }}>
                Prossimo traguardo: <strong style={{ color: 'var(--text)' }}>{milestone.next.toLocaleString()} rip.</strong> · mancano {milestone.remaining.toLocaleString()}
              </div>
              <div style={{ height: 8, background: isLight ? '#ddd' : '#222', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, var(--theme-color), var(--accent2))',
                  width: `${Math.round(milestone.progress * 100)}%`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.62em', color: '#555', marginTop: 3 }}>
                {Math.round(milestone.progress * 100)}%
              </div>
            </>
          )}
        </div>

        {/* ── PERIODO CORRENTE ── */}
        {sectionLabel('📅 Periodo corrente')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Questa settimana</div>
            <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--theme-color)' }}>{stats.weekReps}</div>
            <div style={{ marginTop: 4 }}><DeltaBadge delta={stats.weekDelta} /></div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Questo mese</div>
            <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--theme-color)' }}>{stats.monthReps}</div>
            <div style={{ marginTop: 4 }}><DeltaBadge delta={stats.monthDelta} /></div>
          </div>
        </div>

        {/* ── RECORD ── */}
        {sectionLabel('⚡ Record personali')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <StatCard label="Sessione" value={stats.bestSessionReps || '–'} sub={stats.bestSessionDate ? fmtDate(stats.bestSessionDate) : null} color="#ffca28" />
          <StatCard label="Giorno" value={stats.bestDayReps || '–'} sub={stats.bestDay ? fmtDate(stats.bestDay) : null} color="#ff7043" />
          <StatCard label="Media/sessione" value={stats.avgPerSession || '–'} sub="rip. medie" color="var(--accent2)" />
        </div>
        {recordFreshness && (
          <div style={{ textAlign: 'center', fontSize: '0.72em', color: recordFreshness.days >= 30 ? '#e53935' : '#888', marginTop: 8 }}>
            {recordFreshness.days === 0 ? '🏆 Record battuto oggi!' : `⏳ Nessun record da ${recordFreshness.days} giorn${recordFreshness.days === 1 ? 'o' : 'i'}`}
          </div>
        )}

        {/* ── STREAK ── */}
        {sectionLabel('🔥 Streak')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{
            background: stats.streak.current > 0 ? 'rgba(255,202,40,0.08)' : 'var(--card)',
            border: `1px solid ${stats.streak.current > 0 ? 'var(--theme-color)' : 'var(--card-border)'}`,
            borderRadius: 12, padding: '12px 10px',
          }}>
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Streak attuale</div>
            <div style={{ fontSize: '1.8em', fontWeight: 900, color: stats.streak.current > 0 ? 'var(--theme-color)' : '#444', lineHeight: 1 }}>
              {stats.streak.current > 0 ? `${stats.streak.current}🔥` : '0'}
            </div>
            {stats.streak.current > 0 && stats.streak.currentStart && (
              <div style={{ fontSize: '0.6em', color: '#888', marginTop: 3 }}>dal {fmtDate(stats.streak.currentStart)}</div>
            )}
            <div style={{ fontSize: '0.6em', color: '#555', marginTop: 3 }}>giorni consecutivi</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Record streak</div>
            <div style={{ fontSize: '1.8em', fontWeight: 900, color: '#ff7043', lineHeight: 1 }}>
              {stats.streak.best || '0'}
            </div>
            {stats.streak.bestStart && (
              <div style={{ fontSize: '0.6em', color: '#888', marginTop: 3 }}>
                {fmtDate(stats.streak.bestStart)} – {fmtDate(stats.streak.bestEnd)}
              </div>
            )}
            <div style={{ fontSize: '0.6em', color: '#555', marginTop: 3 }}>giorni consecutivi</div>
          </div>
        </div>

        {/* ── GRAFICO ── */}
        {sectionLabel('📈 Andamento')}
        <div className="switch-group" style={{ marginBottom: 12 }}>
          {[7, 30, 90].map(d => (
            <div key={d} className={`switch-opt${chartDays === d ? ' active' : ''}`} onClick={() => setChartDays(d)}>{d} GG</div>
          ))}
        </div>
        <div style={{ height: 160, marginBottom: 20 }}>
          <canvas ref={canvasRef} />
        </div>

        {/* ── SESSIONI OGGI ── */}
        {stats.todaySessions.length > 0 && (
          <>
            {sectionLabel('⏱ Sessioni di oggi')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {stats.todaySessions.slice().reverse().map((s, i) => {
                const isSessionRecord = s.reps === stats.bestSessionReps && stats.lifetimeSessions > 1
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    background: isSessionRecord ? 'rgba(255,202,40,0.08)' : 'var(--card)',
                    border: `1px solid ${isSessionRecord ? 'var(--theme-color)' : 'var(--card-border)'}`,
                    borderRadius: 10,
                  }}>
                    <span style={{ fontSize: '0.75em', color: '#555', minWidth: 44 }}>{s.time?.slice(0, 5) || ''}</span>
                    <span style={{ flex: 1, fontWeight: 700 }}>{s.reps} reps</span>
                    {isSessionRecord && <span style={{ fontSize: '0.65em', fontWeight: 700, color: 'var(--theme-color)' }}>🏆 record</span>}
                    <span style={{ fontSize: '0.75em', color: 'var(--success)' }}>+{s.pts} pt</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {stats.lifetimeSessions === 0 && (
          <div className="empty-state" style={{ marginTop: 20 }}>
            Nessuna sessione registrata — inizia ora! 💪
          </div>
        )}

        <div style={{ marginBottom: 32 }} />
      </div>
    </div>
  )
}
