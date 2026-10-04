import { useEffect, useRef, useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import { computeLifeAreaStats, computeLifeAreaDailyTotals } from '../lib/lifeAreaStats'
import { Chart } from '../lib/chartSetup'
import LifeAreaTimerCard from './LifeAreaTimerCard'
import LifeAreaWeekView from './LifeAreaWeekView'
import { addDays, mondayOf, shortDayLabel, entriesFor, isAreaFilled, frequentEntries, intentionFor } from '../lib/lifeAreaWeek'

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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function LifeAreaTools({ actions, authUserId, isReadOnly, globalData }) {
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
    <div style={{ paddingTop: 12 }}>
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
              background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 12,
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
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '1em' }}
                  >📓</button>
                  <button
                    className="btn-icon"
                    title="Aggiungi sessione"
                    onClick={() => actions.openModal('lifeAreaLog', { areaId: a.id })}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '1.1em' }}
                  >+</button>
                </div>
              )}
            </div>
            {hasTarget && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
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
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
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
                background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8,
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
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.88em', cursor: 'pointer' }}
          >+ Sessione manuale</button>
          <button
            onClick={() => actions.openModal('lifeAreaManage')}
            style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.88em', cursor: 'pointer' }}
          >⚙️ Gestisci aree</button>
        </div>
      )}
    </div>
  )
}

// ─── Vista principale: "cosa ho fatto oggi" su ogni area ──────────────────────
// Un campo di testo per area, sempre visibile: si scrive, Invio, la voce si
// aggiunge in coda. Sotto il campo, le voci più frequenti come pulsanti a un
// tocco. Niente durata, niente punti — pensata per la compilazione serale.
// "Settimana" apre la revisione (LifeAreaWeekView): mappa di equilibrio,
// riepilogo giorno per giorno e intenzioni. Timer/sessioni/statistiche restano
// sotto, in una sezione richiudibile.

function dayLabel(dateStr) {
  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Oggi'
  if (dateStr === yesterday) return 'Ieri'
  return shortDayLabel(dateStr)
}

function AreaEntryInput({ area, date, actions }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  async function submit() {
    const value = text.trim()
    if (!value) return
    setText('')
    inputRef.current?.focus()
    const ok = await actions.addLifeAreaNote(area.id, value, date)
    if (ok === false) setText(prev => prev || value)
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder={date === toDateString(new Date()) ? 'Cosa hai fatto oggi?' : 'Cosa hai fatto quel giorno?'}
        maxLength={1000}
        enterKeyHint="send"
        style={{
          flex: 1, minWidth: 0, padding: '10px 12px', fontSize: '0.9em',
          background: 'var(--surface-2, rgba(255,255,255,0.05))', color: 'var(--text)',
          border: '1px solid var(--card-border)', borderRadius: 10, outline: 'none',
        }}
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        aria-label={`Aggiungi a ${area.name}`}
        style={{
          width: 44, flexShrink: 0, borderRadius: 10, border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          background: text.trim() ? (area.color || 'var(--theme-color)') : 'var(--surface-2, rgba(255,255,255,0.05))',
          color: text.trim() ? '#000' : '#555', fontSize: '1.3em', fontWeight: 800,
        }}
      >＋</button>
    </div>
  )
}

// Voci frequenti a un tocco: un tap aggiunge la voce al giorno selezionato.
function QuickChips({ area, date, suggestions, actions }) {
  if (!suggestions.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {suggestions.map(text => (
        <button
          key={text}
          onClick={() => actions.addLifeAreaNote(area.id, text, date)}
          style={{
            padding: '5px 10px', borderRadius: 14, cursor: 'pointer', fontSize: '0.78em',
            background: 'transparent', color: 'var(--text)',
            border: `1px dashed ${area.color || 'var(--theme-color)'}`,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >+ {text}</button>
      ))}
    </div>
  )
}

function AreaEntry({ note, date, actions, isReadOnly }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(note.text)

  async function save() {
    setEditing(false)
    const v = value.trim()
    if (v && v !== note.text) await actions.editLifeAreaNote(date, note.id, v)
    else setValue(note.text)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValue(note.text); setEditing(false) } }}
        maxLength={1000}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '0.86em', background: 'var(--surface-2, rgba(255,255,255,0.05))', color: 'var(--text)', border: '1px solid var(--theme-color)', borderRadius: 8, outline: 'none' }}
      />
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
      <span style={{ color: '#666', lineHeight: '1.5em' }}>•</span>
      <span
        onClick={() => { if (!isReadOnly) { setValue(note.text); setEditing(true) } }}
        style={{ flex: 1, fontSize: '0.88em', lineHeight: 1.5, wordBreak: 'break-word', cursor: isReadOnly ? 'default' : 'text' }}
      >{note.text}</span>
      {!isReadOnly && (
        <button
          onClick={() => actions.deleteLifeAreaNote(date, note.id)}
          aria-label="Elimina voce"
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1em', padding: '2px 4px', lineHeight: 1 }}
        >×</button>
      )}
    </div>
  )
}

function DayView({ globalData, areas, date, setDate, actions, isReadOnly }) {
  const today = toDateString(new Date())
  const ideas = globalData?.lifeAreaIdeas || []
  const weekKey = mondayOf(date)
  const filledCount = areas.filter(a => isAreaFilled(globalData, a.id, date)).length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.78em', color: '#888' }}>
          {filledCount === areas.length && areas.length > 0 ? '✅ Tutte le aree compilate' : `${filledCount}/${areas.length} aree compilate`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => setDate(d => addDays(d, -1))} aria-label="Giorno precedente"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}>
            <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_left</span>
          </button>
          <button onClick={() => setDate(today)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 700, fontSize: '0.9em', minWidth: 64, textAlign: 'center' }}>
            {dayLabel(date)}
          </button>
          <button onClick={() => setDate(d => addDays(d, 1))} disabled={date >= today} aria-label="Giorno successivo"
            style={{ background: 'none', border: 'none', cursor: date >= today ? 'default' : 'pointer', color: date >= today ? '#444' : 'var(--text)', padding: 4 }}>
            <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {areas.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85em', padding: '16px 0' }}>Nessuna area ancora — creane una da "Strumenti".</p>
      )}

      {areas.map(a => {
        const entries = entriesFor(globalData, a.id, date)
        const notes = entries.filter(e => e.kind === 'note')
        const sessions = entries.filter(e => e.kind === 'session')
        const suggestions = isReadOnly ? [] : frequentEntries(globalData?.lifeAreaNotes, a.id, { exclude: notes.map(n => n.text) })
        const intention = intentionFor(globalData, weekKey, a.id)
        const pendingIdeas = ideas.filter(i => i.areaId === a.id && !i.done).length
        return (
          <div key={a.id} style={{
            padding: '12px 14px', marginBottom: 10,
            background: 'var(--surface)', border: '1px solid var(--card-border)',
            borderLeft: `4px solid ${a.color || 'var(--theme-color)'}`, borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3em' }}>{a.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95em', flex: 1 }}>{a.name}</span>
              <span style={{ fontSize: '0.72em', color: entries.length ? 'var(--success)' : '#666', fontWeight: 600 }}>
                {entries.length ? `✓ ${entries.length}` : 'niente'}
              </span>
              {!isReadOnly && (
                <button
                  onClick={() => actions.openModal('lifeAreaDetail', { areaId: a.id })}
                  title="Storico e spunti"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1em', padding: '2px 4px' }}
                >📓{pendingIdeas > 0 && <sup style={{ fontSize: '0.6em', color: 'var(--theme-color)', fontWeight: 800 }}>{pendingIdeas}</sup>}</button>
              )}
            </div>
            {intention && (
              <div style={{ fontSize: '0.76em', color: a.color || 'var(--theme-color)', marginTop: 4 }}>🎯 {intention}</div>
            )}
            {entries.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {notes.map(n => <AreaEntry key={n.id} note={n} date={date} actions={actions} isReadOnly={isReadOnly} />)}
                {sessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '0.84em', color: '#999' }}>
                    <span>⏱</span><span>{s.text ? `${s.text} · ` : ''}{s.duration} min</span>
                  </div>
                ))}
              </div>
            )}
            {!isReadOnly && <AreaEntryInput area={a} date={date} actions={actions} />}
            {!isReadOnly && <QuickChips area={a} date={date} suggestions={suggestions} actions={actions} />}
          </div>
        )
      })}
    </>
  )
}

export default function LifeAreaTab({ actions, authUserId, isReadOnly, globalData }) {
  const [view, setView] = useState('day') // 'day' | 'week'
  const [date, setDate] = useState(() => toDateString(new Date()))
  const [toolsOpen, setToolsOpen] = useState(false)

  const areas = (globalData?.lifeAreas || []).filter(a => a.active !== false)

  function openDay(d) {
    setDate(d)
    setView('day')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const segBtn = (id, label) => (
    <button
      onClick={() => setView(id)}
      style={{
        flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', borderRadius: 8,
        fontWeight: 700, fontSize: '0.82em',
        background: view === id ? 'var(--theme-color)' : 'transparent',
        color: view === id ? '#000' : '#888',
      }}
    >{label}</button>
  )

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: '1.1em', fontWeight: 800, margin: 0 }}>🌱 Aree</h2>
        <div style={{ flex: 1, display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)' }}>
          {segBtn('day', 'Giorno')}
          {segBtn('week', 'Settimana')}
        </div>
      </div>

      {view === 'day'
        ? <DayView globalData={globalData} areas={areas} date={date} setDate={setDate} actions={actions} isReadOnly={isReadOnly} />
        : <LifeAreaWeekView globalData={globalData} areas={areas} actions={actions} isReadOnly={isReadOnly} onOpenDay={openDay} />}

      <button
        onClick={() => setToolsOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: '18px 0 4px' }}
      >
        <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Strumenti: timer, sessioni, statistiche, gestione aree</span>
        <span className="material-icons-round" style={{ fontSize: 16, color: '#666' }}>{toolsOpen ? 'expand_less' : 'expand_more'}</span>
      </button>
      {toolsOpen && <LifeAreaTools actions={actions} authUserId={authUserId} isReadOnly={isReadOnly} globalData={globalData} />}
    </div>
  )
}
