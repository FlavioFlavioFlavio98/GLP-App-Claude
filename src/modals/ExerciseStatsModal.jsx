import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { _getPPR } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'

const MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m)-1]} ${y}`
}

// ─── Stats computation ───────────────────────────────────────────────────────

function computeStats(exerciseLog, exerciseId, days) {
  const today = new Date()
  const todayStr = toDateString(today)

  // Build sorted date list
  const allDates = Object.keys(exerciseLog || {}).sort()

  // Filter sessions for this exercise
  function sessionsForDate(dateStr) {
    return (exerciseLog[dateStr] || []).filter(s => s.exerciseId === exerciseId)
  }

  // Period cutoff
  let cutoff = null
  if (days !== 'all') {
    const c = new Date(today); c.setDate(today.getDate() - days + 1); cutoff = toDateString(c)
  }

  const datesInPeriod = allDates.filter(d => !cutoff || d >= cutoff)

  // Today sessions
  const todaySessions = sessionsForDate(todayStr)
  const todayReps = todaySessions.reduce((a, s) => a + s.reps, 0)
  const todayPts = Math.round(todaySessions.reduce((a, s) => a + s.pts, 0) * 100) / 100

  // Week
  const weekCutoff = (() => { const d = new Date(today); d.setDate(today.getDate() - 6); return toDateString(d) })()
  const weekReps = allDates.filter(d => d >= weekCutoff).reduce((a, d) => a + sessionsForDate(d).reduce((x, s) => x + s.reps, 0), 0)

  // Month
  const mm = String(today.getMonth()+1).padStart(2,'0')
  const monthPrefix = `${today.getFullYear()}-${mm}`
  const monthReps = allDates.filter(d => d.startsWith(monthPrefix)).reduce((a, d) => a + sessionsForDate(d).reduce((x, s) => x + s.reps, 0), 0)

  // Lifetime
  const lifetimeReps = allDates.reduce((a, d) => a + sessionsForDate(d).reduce((x, s) => x + s.reps, 0), 0)
  const lifetimePts = Math.round(allDates.reduce((a, d) => a + sessionsForDate(d).reduce((x, s) => x + s.pts, 0), 0) * 100) / 100

  // Daily record
  let bestDay = null, bestDayReps = 0
  allDates.forEach(d => {
    const r = sessionsForDate(d).reduce((a, s) => a + s.reps, 0)
    if (r > bestDayReps) { bestDayReps = r; bestDay = d }
  })

  // Session record
  let bestSession = null, bestSessionReps = 0
  allDates.forEach(d => {
    sessionsForDate(d).forEach(s => {
      if (s.reps > bestSessionReps) { bestSessionReps = s.reps; bestSession = { ...s, date: d } }
    })
  })

  // Chart data (last N days)
  const chartDates = []
  for (let i = (days === 'all' ? 30 : days) - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    chartDates.push(toDateString(d))
  }
  const chartData = chartDates.map(d => sessionsForDate(d).reduce((a, s) => a + s.reps, 0))

  return {
    todayReps, todayPts, weekReps, monthReps,
    lifetimeReps, lifetimePts,
    bestDay, bestDayReps,
    bestSession, bestSessionReps,
    chartDates, chartData,
    datesInPeriod,
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ExerciseStatsModal() {
  const { state, actions } = useApp()
  const { modal, allUsersData, authUserId } = state

  // ALL hooks before any return
  const [tab, setTab] = useState('stats')   // 'stats' | 'manage'
  const [selExId, setSelExId] = useState(null)
  const [chartDays, setChartDays] = useState(30)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editEx, setEditEx] = useState(null)
  const [form, setForm] = useState({ name: '', emoji: '💪', pointsPerRep: '0.1' })
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const gd = allUsersData?.flavio
  const exercises = (gd?.quickExercises || [])
  const activeEx = exercises.filter(e => e.active !== false)

  // Auto-select first exercise
  useEffect(() => {
    if (modal === 'exerciseStats' && activeEx.length > 0 && !selExId) {
      setSelExId(activeEx[0].id)
    }
  }, [modal, activeEx.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const exercise = exercises.find(e => e.id === selExId) || activeEx[0]
  const stats = exercise ? computeStats(gd?.exerciseLog || {}, exercise.id, chartDays) : null

  // Chart
  useEffect(() => {
    if (!canvasRef.current || !stats) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: stats.chartDates.map(d => { const [,m,dd] = d.split('-'); return `${parseInt(dd)}/${parseInt(m)}` }),
        datasets: [{
          data: stats.chartData,
          backgroundColor: 'var(--theme-color)',
          borderRadius: 3, barPercentage: 0.7,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#2a2a2a' }, ticks: { color: '#666', stepSize: 5 } },
          x: { grid: { display: false }, ticks: { color: '#666', maxTicksLimit: 8 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [selExId, chartDays, gd?.exerciseLog])

  if (modal !== 'exerciseStats') return null
  if (authUserId !== 'flavio') return null

  const todayStr = toDateString(new Date())

  // All sessions sorted by date desc, then time desc
  const allSessions = []
  Object.keys(gd?.exerciseLog || {}).sort().reverse().forEach(dateStr => {
    const dayEntries = (gd.exerciseLog[dateStr] || [])
      .filter(s => !selExId || s.exerciseId === selExId)
      .map(s => ({ ...s, date: dateStr }))
    if (dayEntries.length > 0) allSessions.push({ dateStr, entries: dayEntries.slice().reverse() })
  })

  async function handleSaveExercise() {
    if (!form.name.trim()) return
    setSaving(true)
    const data = editEx ? { ...editEx, name: form.name.trim(), emoji: form.emoji, pointsPerRep: form.pointsPerRep } : form
    await actions.saveExercise(data)
    setSaving(false)
    setShowAddForm(false)
    setEditEx(null)
    setForm({ name: '', emoji: '💪', pointsPerRep: '0.1' })
  }

  function openEdit(ex) {
    setEditEx(ex)
    setForm({ name: ex.name, emoji: ex.emoji, pointsPerRep: String(ex.pointsPerRep) })
    setShowAddForm(true)
  }

  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>{children}</div>
  )

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.3em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.6em', color: '#555', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.58em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.15em', color: 'var(--theme-color)', flex: 1 }}>Esercizi 💪</h1>
        <button
          className="btn-icon"
          onClick={() => { actions.closeModal(); setTimeout(() => actions.openModal('quickExercise'), 60) }}
          title="Inserisci sessione"
        >
          <span className="material-icons-round" style={{ fontSize: 22 }}>add_circle</span>
        </button>
      </div>

      {/* Main tab nav: Statistiche | Gestione */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222', background: 'var(--card)' }}>
        {[
          { id: 'stats',  label: '📊 Statistiche' },
          { id: 'manage', label: '⚙️ Gestisci' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 8px', border: 'none', background: 'transparent', cursor: 'pointer',
            color: tab === t.id ? 'var(--theme-color)' : '#555',
            borderBottom: tab === t.id ? '2px solid var(--theme-color)' : '2px solid transparent',
            fontWeight: tab === t.id ? 700 : 400, fontSize: '0.85em',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      <div className="single-habit-body">

      {tab === 'stats' && (<>
        {/* Exercise selector chips (stats tab) */}
        {activeEx.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {activeEx.map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelExId(ex.id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: '0.85em', fontWeight: 600,
                  background: selExId === ex.id ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selExId === ex.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
                  color: selExId === ex.id ? 'var(--theme-color)' : '#888',
                }}
              >{ex.emoji} {ex.name}</button>
            ))}
          </div>
        )}

        {/* ── OGGI ── */}
        {stats && (
          <>
            <SectionTitle>Oggi</SectionTitle>
            {(gd?.exerciseLog?.[todayStr] || []).filter(s => s.exerciseId === (exercise?.id)).length === 0 ? (
              <div style={{ fontSize: '0.82em', color: '#555', marginBottom: 16 }}>Nessuna sessione oggi</div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {(gd?.exerciseLog?.[todayStr] || [])
                    .filter(s => s.exerciseId === (exercise?.id))
                    .slice().reverse()
                    .map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                        <span style={{ fontSize: '0.78em', color: '#666', minWidth: 52 }}>{s.time?.slice(0,5) || ''}</span>
                        <span style={{ flex: 1, fontWeight: 700 }}>{s.reps} reps</span>
                        <span style={{ fontSize: '0.78em', color: 'var(--success)', fontWeight: 600 }}>+{s.pts} pt</span>
                        <button
                          className="btn-icon"
                          onClick={async () => {
                            if (!window.confirm(`Annullare ${s.reps} reps (-${s.pts} pt)?`)) return
                            await actions.deleteExerciseSession(todayStr, s.id)
                          }}
                          title="Annulla sessione"
                        >
                          <span className="material-icons-round" style={{ fontSize: 16, color: '#555' }}>delete</span>
                        </button>
                      </div>
                    ))
                  }
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginBottom: 16 }}>
                  Totale oggi: <strong style={{ color: 'var(--theme-color)' }}>{stats.todayReps} reps</strong> · <strong style={{ color: 'var(--success)' }}>+{stats.todayPts} pt</strong>
                </div>
              </>
            )}
          </>
        )}

        {/* ── STATISTICHE GRIGLIA ── */}
        {stats && (
          <>
            <SectionTitle>Statistiche</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              <StatCard label="Oggi" value={stats.todayReps} color={stats.todayReps > 0 ? 'var(--theme-color)' : '#555'} />
              <StatCard label="Settimana" value={stats.weekReps} />
              <StatCard label="Mese" value={stats.monthReps} />
              <StatCard label="Record giorno" value={`${stats.bestDayReps}`} sub={stats.bestDay ? fmtDate(stats.bestDay) : '-'} color="var(--success)" />
              <StatCard label="Record sessione" value={`${stats.bestSessionReps}`} sub={stats.bestSession ? `${fmtDate(stats.bestSession.date)} ${stats.bestSession.time?.slice(0,5)||''}` : '-'} color="#EF9F27" />
              <StatCard label="Lifetime" value={`${stats.lifetimeReps}`} sub={`+${stats.lifetimePts} pt`} color="var(--success)" />
            </div>
          </>
        )}

        {/* ── GRAFICO ── */}
        {stats && (
          <>
            <SectionTitle>Andamento</SectionTitle>
            <div className="switch-group" style={{ marginBottom: 12 }}>
              {[7, 30, 90].map(d => (
                <div key={d} className={`switch-opt${chartDays === d ? ' active' : ''}`} onClick={() => setChartDays(d)}>{d} GG</div>
              ))}
            </div>
            <div style={{ height: 160, marginBottom: 20, position: 'relative' }}>
              <canvas ref={canvasRef} />
            </div>
          </>
        )}

        {/* ── STORICO ── */}
        {allSessions.length === 0 && !stats && (
          <div className="empty-state">Nessuna sessione registrata</div>
        )}

        {allSessions.length > 0 && (
          <>
            <SectionTitle>Storico Sessioni</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {allSessions.slice(0, 20).map(({ dateStr, entries }) => {
                const dayReps = entries.reduce((a, s) => a + s.reps, 0)
                const dayPts = Math.round(entries.reduce((a, s) => a + s.pts, 0) * 100) / 100
                return (
                  <div key={dateStr}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72em', color: '#666', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700 }}>{fmtDate(dateStr)}</span>
                      <span>{dayReps} reps · +{dayPts} pt</span>
                    </div>
                    {entries.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: '0.72em', color: '#555', minWidth: 44 }}>{s.time?.slice(0,5)||''}</span>
                        <span style={{ flex: 1, fontSize: '0.82em' }}>{s.reps} reps</span>
                        <span style={{ fontSize: '0.72em', color: 'var(--success)' }}>+{s.pts} pt</span>
                        <button
                          className="btn-icon"
                          onClick={async () => {
                            if (!window.confirm(`Annullare ${s.reps} reps (-${s.pts} pt)?`)) return
                            await actions.deleteExerciseSession(dateStr, s.id)
                          }}
                        >
                          <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </>)}  {/* end tab === 'stats' */}

      {tab === 'manage' && (
        <ManageExercisesTab
          exercises={exercises}
          showAddForm={showAddForm} setShowAddForm={setShowAddForm}
          editEx={editEx} setEditEx={setEditEx}
          form={form} setForm={setForm}
          saving={saving}
          onSave={handleSaveExercise}
          onArchive={id => { if (window.confirm('Archiviare?')) actions.archiveExercise(id) }}
          openEdit={openEdit}
        />
      )}

      </div>
    </div>
  )
}

// ─── Manage tab extracted for clarity ────────────────────────────────────────
function ManageExercisesTab({ exercises, showAddForm, setShowAddForm, editEx, setEditEx, form, setForm, saving, onSave, onArchive, openEdit }) {
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: '0.9em', width: '100%', boxSizing: 'border-box' }

  return (
    <>
      {/* Exercise list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85em', padding: '20px 0' }}>Nessun esercizio — creane uno!</div>
        )}
        {exercises.map(ex => (
          <div key={ex.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, opacity: ex.active === false ? 0.5 : 1 }}>
            <span style={{ fontSize: '1.5em', flexShrink: 0 }}>{ex.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92em' }}>{ex.name}</div>
              <div style={{ fontSize: '0.72em', color: 'var(--theme-color)', fontWeight: 600, marginTop: 2 }}>
                {parseFloat(ex.pointsPerRep)} pt / rep
              </div>
              {(ex.changes || []).length > 1 && (
                <div style={{ fontSize: '0.6em', color: '#444', marginTop: 4, lineHeight: 1.6 }}>
                  {ex.changes.map(c => `${c.date}: ${c.pointsPerRep}pt/rep`).join(' → ')}
                </div>
              )}
            </div>
            <button className="btn-icon" onClick={() => openEdit(ex)} title="Modifica">
              <span className="material-icons-round" style={{ fontSize: 20 }}>edit</span>
            </button>
            {ex.active !== false && (
              <button className="btn-icon" onClick={() => onArchive(ex.id)} title="Archivia">
                <span className="material-icons-round" style={{ fontSize: 18, color: '#555' }}>archive</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showAddForm ? (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--theme-color)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--theme-color)', marginBottom: 14, fontSize: '0.9em' }}>
            {editEx ? `✏️ Modifica: ${editEx.name}` : '+ Nuovo Esercizio'}
          </div>

          {/* Emoji + name row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text" placeholder="💪" value={form.emoji} maxLength={4}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
              style={{ ...inputStyle, width: 52, textAlign: 'center', fontSize: '1.5em', padding: '6px 4px' }}
            />
            <input
              type="text" placeholder="Nome esercizio (es. Addominali)" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          {/* Points per rep */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              Punti per ripetizione
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.01" min="0.01" max="10" placeholder="0.1"
                value={form.pointsPerRep}
                onChange={e => setForm(f => ({ ...f, pointsPerRep: e.target.value }))}
                style={{ ...inputStyle, width: 90, fontSize: '1.1em', fontWeight: 700 }}
              />
              <span style={{ color: '#666', fontSize: '0.82em' }}>pt / rep</span>
              <span style={{ color: '#444', fontSize: '0.72em' }}>
                (es. 15 reps = +{parseFloat((15 * (parseFloat(form.pointsPerRep) || 0.1)).toFixed(2))} pt)
              </span>
            </div>
            {editEx && parseFloat(form.pointsPerRep) !== parseFloat(editEx.pointsPerRep) && (
              <div style={{ fontSize: '0.68em', color: '#EF9F27', marginTop: 6 }}>
                ⚠️ Cambio da {editEx.pointsPerRep} → {form.pointsPerRep} pt/rep. Verrà salvato con data odierna nei cambiamenti.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-main" style={{ flex: 1, padding: '11px', margin: 0 }} onClick={onSave} disabled={saving || !form.name.trim()}>
              {saving ? '⏳' : '💾 Salva'}
            </button>
            <button className="btn-sec" style={{ padding: '11px 16px' }} onClick={() => { setShowAddForm(false); setEditEx(null) }}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-main"
          style={{ width: '100%' }}
          onClick={() => { setForm({ name: '', emoji: '💪', pointsPerRep: '0.1' }); setEditEx(null); setShowAddForm(true) }}
        >
          + Nuovo Esercizio
        </button>
      )}
    </>
  )
}
