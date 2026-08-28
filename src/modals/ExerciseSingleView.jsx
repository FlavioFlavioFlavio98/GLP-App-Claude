import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'
import { computeAllStats, getDaysSinceLastRecord, getEffortEmoji } from '../lib/workoutStats'
import ExerciseIcon from '../components/ExerciseIcon'

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

// Heatmap frequenza: ultime ~18 settimane (poco più di 4 mesi), stile
// GitHub — colora in base a quante volte quel giorno hai fatto l'esercizio
// (di solito 0 o 1, ma qualche giorno può capitare 2+ sessioni).
function heatmapColor(count, isLight) {
  if (!count) return isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'
  if (count === 1) return 'rgba(255,202,40,0.45)'
  if (count === 2) return 'rgba(255,202,40,0.75)'
  return 'rgba(255,202,40,1)'
}

function ExerciseHeatmap({ exerciseLog, exerciseId, isLight }) {
  const WEEKS = 18
  const weeks = useMemo(() => {
    const today = new Date()
    const dow = today.getDay() || 7 // lunedì = 1 ... domenica = 7
    const thisMonday = new Date(today)
    thisMonday.setDate(today.getDate() - (dow - 1))

    const result = []
    for (let w = WEEKS - 1; w >= 0; w--) {
      const weekStart = new Date(thisMonday)
      weekStart.setDate(thisMonday.getDate() - w * 7)
      const week = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(weekStart)
        cur.setDate(weekStart.getDate() + d)
        const key = toDateString(cur)
        const count = (exerciseLog[key] || []).filter(s => s.exerciseId === exerciseId).length
        week.push({ key, count, future: cur > today })
      }
      result.push(week)
    }
    return result
  }, [exerciseLog, exerciseId])

  const activeDays = weeks.flat().filter(d => !d.future && d.count > 0).length
  const totalDays = weeks.flat().filter(d => !d.future).length
  const frequencyPct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px', marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {week.map((day, di) => (
              <div
                key={di}
                title={day.future ? '' : `${day.key}: ${day.count > 0 ? `${day.count} sessione${day.count === 1 ? '' : 'i'}` : 'niente'}`}
                style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: day.future ? 'transparent' : heatmapColor(day.count, isLight),
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.68em', color: '#888', marginTop: 8 }}>
        Fatto <strong style={{ color: 'var(--theme-color)' }}>{activeDays}</strong> giorni su {totalDays} (~{frequencyPct}%) nelle ultime {WEEKS} settimane
      </div>
    </div>
  )
}

const EFFORT_INFO = {
  1: { label: 'Leggero', emoji: '🟢', color: '#4caf50' },
  2: { label: 'Medio', emoji: '🟡', color: '#ffca28' },
  3: { label: 'Massimo', emoji: '🔴', color: '#e53935' },
}

function EffortDistribution({ effortCounts }) {
  const total = effortCounts[1] + effortCounts[2] + effortCounts[3]
  const max = Math.max(effortCounts[1], effortCounts[2], effortCounts[3], 1)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px', marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(level => {
        const count = effortCounts[level]
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const info = EFFORT_INFO[level]
        return (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 76, flexShrink: 0, fontSize: '0.75em', color: '#888' }}>{info.emoji} {info.label}</div>
            <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, height: '100%', borderRadius: 6, background: info.color, transition: 'width 0.4s' }} />
            </div>
            <div style={{ width: 56, flexShrink: 0, fontSize: '0.7em', color: '#666', textAlign: 'right' }}>{count} · {pct}%</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExerciseSingleView() {
  const { state, actions } = useApp()
  const { modal, modalPayload, allUsersData, authUserId } = state

  const [chartDays, setChartDays] = useState(30)
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  const gd = allUsersData?.flavio
  const exerciseId = modalPayload?.exerciseId
  const exercise = (gd?.quickExercises || []).find(e => e.id === exerciseId)
  const exerciseLog = gd?.exerciseLog || {}
  const todayStr = toDateString(new Date())

  const stats = useMemo(
    () => computeAllStats(exerciseLog, exerciseId),
    [exerciseLog, exerciseId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const recordFreshness = useMemo(
    () => getDaysSinceLastRecord(exerciseLog, exerciseId),
    [exerciseLog, exerciseId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const milestone = getMilestoneInfo(stats.lifetimeReps)
  const funFact = getFunFact(exercise?.name, stats.lifetimeReps)

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

  if (modal !== 'exerciseSingle') return null
  if (authUserId !== 'flavio') return null
  if (!exercise) return null

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
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)', flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExerciseIcon exercise={exercise} size={24} />
          {exercise.name}
        </h1>
        <button
          className="btn-icon"
          onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('exerciseStats', { editExerciseId: exercise.id }), 60) }}
          title="Modifica esercizio (nome, emoji, pt/rep)"
        >
          <span className="material-icons-round" style={{ fontSize: 22 }}>edit</span>
        </button>
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
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ultimi 7gg</div>
            <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--theme-color)' }}>{stats.weekReps}</div>
            <div style={{ marginTop: 4 }}><DeltaBadge delta={stats.weekDelta} /></div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: '0.6em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ultimi 30gg</div>
            <div style={{ fontSize: '1.6em', fontWeight: 900, color: 'var(--theme-color)' }}>{stats.monthReps}</div>
            <div style={{ marginTop: 4 }}><DeltaBadge delta={stats.monthDelta} /></div>
          </div>
        </div>

        {/* ── RECORD ── */}
        {sectionLabel('⚡ Record personali')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="Sessione (reps)" value={stats.bestSessionReps || '–'} sub={stats.bestSessionDate ? fmtDate(stats.bestSessionDate) : null} color="#ffca28" />
          <StatCard label="Giorno (reps)" value={stats.bestDayReps || '–'} sub={stats.bestDay ? fmtDate(stats.bestDay) : null} color="#ff7043" />
          {/* Punti max, non solo reps: a parità di reps lo sforzo percepito cambia il punteggio */}
          <StatCard label="Giorno (pt)" value={stats.bestPtsDayValue > 0 ? `+${stats.bestPtsDayValue}` : '–'} sub={stats.bestPtsDay ? fmtDate(stats.bestPtsDay) : null} color="var(--success)" />
          <StatCard label="Media/sessione" value={stats.avgPerSession || '–'} sub="rip. medie" color="var(--accent2)" />
        </div>
        {recordFreshness && (
          <div style={{ textAlign: 'center', fontSize: '0.72em', color: recordFreshness.days >= 30 ? '#e53935' : '#888', marginTop: 8 }}>
            {recordFreshness.days === 0 ? '🏆 Record battuto oggi!' : `⏳ Nessun record da ${recordFreshness.days} giorn${recordFreshness.days === 1 ? 'o' : 'i'}`}
          </div>
        )}

        {/* ── HEATMAP ── quanto spesso lo alleni, a colpo d'occhio (non ha
             senso uno streak per un esercizio che non fai mai 2 giorni di
             fila — questa mostra la frequenza reale senza penalizzare chi si
             allena a giorni alterni) */}
        {sectionLabel('🗓️ Frequenza')}
        <ExerciseHeatmap exerciseLog={exerciseLog} exerciseId={exerciseId} isLight={isLight} />

        {/* ── SFORZO PERCEPITO ── quante volte leggero/medio/a cedimento:
             le sole reps non dicono se ti alleni sempre facile o al limite */}
        {(stats.effortCounts[1] + stats.effortCounts[2] + stats.effortCounts[3]) > 0 && (
          <>
            {sectionLabel('🎚️ Sforzo percepito')}
            <EffortDistribution effortCounts={stats.effortCounts} />
          </>
        )}

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

        {/* ── STORICO SESSIONI ── tutti i giorni, non solo oggi: reps E punti
             per giorno, perché a parità di reps lo sforzo percepito cambia
             il punteggio (es. 100 reps leggere vs 100 reps a cedimento) */}
        {stats.history.length > 0 && (
          <>
            {sectionLabel('⏱ Storico sessioni')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
              {stats.history.slice(0, 30).map(({ date, reps, pts, sessions }) => (
                <div key={date}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72em', color: '#666', marginBottom: 5 }}>
                    <span style={{ fontWeight: 700 }}>{date === todayStr ? 'Oggi' : fmtDate(date)}</span>
                    <span>{reps} reps · <span style={{ color: 'var(--success)' }}>+{pts} pt</span></span>
                  </div>
                  {sessions.map(s => {
                    const isSessionRecord = s.reps === stats.bestSessionReps && stats.lifetimeSessions > 1
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', marginBottom: 4,
                        background: isSessionRecord ? 'rgba(255,202,40,0.08)' : 'var(--card)',
                        border: `1px solid ${isSessionRecord ? 'var(--theme-color)' : 'var(--card-border)'}`,
                        borderRadius: 10,
                      }}>
                        <span style={{ fontSize: '0.75em', color: '#555', minWidth: 44 }}>{s.time?.slice(0, 5) || ''}</span>
                        {s.effort && <span style={{ fontSize: '0.8em' }}>{getEffortEmoji(s.effort)}</span>}
                        <span style={{ flex: 1, fontWeight: 700 }}>
                          {s.reps} reps{s.load > 0 ? ` · ${s.load}kg` : ''}
                        </span>
                        {isSessionRecord && <span style={{ fontSize: '0.65em', fontWeight: 700, color: 'var(--theme-color)' }}>🏆 record</span>}
                        <span style={{ fontSize: '0.75em', color: 'var(--success)' }}>+{s.pts} pt</span>
                        <button
                          className="btn-icon"
                          style={{ padding: 2 }}
                          title="Modifica ripetizioni"
                          onClick={async () => {
                            const val = window.prompt(`Ripetizioni (attuali: ${s.reps}):`, s.reps)
                            if (val === null) return
                            await actions.editExerciseSession(date, s.id, val)
                          }}
                        >
                          <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>edit</span>
                        </button>
                        <button
                          className="btn-icon"
                          style={{ padding: 2 }}
                          title="Elimina serie"
                          onClick={async () => {
                            if (!window.confirm(`Eliminare ${s.reps} reps (-${s.pts} pt)?`)) return
                            await actions.deleteExerciseSession(date, s.id)
                          }}
                        >
                          <span className="material-icons-round" style={{ fontSize: 15, color: '#555' }}>delete</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
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
