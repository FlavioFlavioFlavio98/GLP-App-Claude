import { useState } from 'react'
import { toDateString } from '../lib/habitLogic'

function fmtTime(seconds) {
  const s = Math.floor(seconds || 0)
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.65em', color: '#555', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: '1.15em', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.6em', color: '#444', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Heatmap (last 52 weeks) ───────────────────────────────────────────────────
function Heatmap({ dailyStats }) {
  const today = new Date()
  const todayStr = toDateString(today)
  // Build 52×7 grid of dates ending today
  const cellSize = 10
  const gap = 2
  const weeks = 30
  const days = weeks * 7
  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    dates.push(toDateString(d))
  }
  // Max minutes for color scale
  const maxSeconds = Math.max(...dates.map(d => dailyStats[d]?.timeSeconds || 0), 1)
  const colorFor = (secs) => {
    if (!secs) return 'rgba(255,255,255,0.04)'
    const ratio = Math.min(secs / maxSeconds, 1)
    if (ratio < 0.25) return '#1a3a2a'
    if (ratio < 0.5) return '#1f5c3a'
    if (ratio < 0.75) return '#2d8656'
    return '#39c176'
  }
  // pad to start on Monday
  const firstDay = new Date(today)
  firstDay.setDate(today.getDate() - (days - 1))
  const startPad = (firstDay.getDay() + 6) % 7 // 0=Mon ... 6=Sun
  const allCells = [...Array(startPad).fill(null), ...dates]

  const svgWidth = weeks * (cellSize + gap)
  const svgHeight = 7 * (cellSize + gap)

  return (
    <div style={{ overflowX: 'auto', marginBottom: 4 }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        {allCells.map((date, i) => {
          if (!date) return null
          const col = Math.floor(i / 7)
          const row = i % 7
          const x = col * (cellSize + gap)
          const y = row * (cellSize + gap)
          const secs = dailyStats[date]?.timeSeconds || 0
          return (
            <rect
              key={date}
              x={x} y={y} width={cellSize} height={cellSize}
              rx={2} ry={2}
              fill={colorFor(secs)}
            >
              <title>{date}: {fmtTime(secs)}</title>
            </rect>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.6em', color: '#444' }}>
        <span>30 settimane fa</span><span>oggi</span>
      </div>
    </div>
  )
}

// ── Bar chart — days of week ─────────────────────────────────────────────────
function WeekdayChart({ dailyStats }) {
  const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
  const totals = Array(7).fill(0)
  const counts = Array(7).fill(0)
  Object.entries(dailyStats || {}).forEach(([date, s]) => {
    const dow = (new Date(date + 'T12:00:00').getDay() + 6) % 7 // Mon=0
    totals[dow] += s.timeSeconds || 0
    counts[dow] += 1
  })
  const avgs = totals.map((t, i) => counts[i] > 0 ? t / counts[i] : 0)
  const maxAvg = Math.max(...avgs, 1)

  const W = 220, H = 60, barW = 22, gap = 10, leftPad = 8
  return (
    <svg width={W} height={H + 18} style={{ display: 'block', margin: '0 auto' }}>
      {avgs.map((avg, i) => {
        const bh = Math.max(2, (avg / maxAvg) * H)
        const x = leftPad + i * (barW + gap)
        return (
          <g key={i}>
            <rect x={x} y={H - bh} width={barW} height={bh} fill="var(--theme-color)" rx={3} opacity={0.75} />
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fill="#555" fontSize={9}>{DAY_LABELS[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Line chart — last 30 days ─────────────────────────────────────────────────
function LineChart({ dailyStats }) {
  const today = new Date()
  const dates = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    dates.push(toDateString(d))
  }
  const values = dates.map(d => dailyStats[d]?.timeSeconds || 0)
  const maxV = Math.max(...values, 60)
  const W = 300, H = 60, padX = 4
  const stepX = (W - padX * 2) / (dates.length - 1)
  const pts = values.map((v, i) => {
    const x = padX + i * stepX
    const y = H - (v / maxV) * H
    return `${x},${y}`
  })
  return (
    <svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`} style={{ display: 'block', width: '100%' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--theme-color)" strokeWidth={1.5} strokeLinejoin="round" />
      {pts.map((pt, i) => {
        if (!values[i]) return null
        const [x, y] = pt.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r={2} fill="var(--theme-color)" />
      })}
      <text x={padX} y={H + 14} fill="#444" fontSize={8}>30 giorni fa</text>
      <text x={W - padX} y={H + 14} fill="#444" fontSize={8} textAnchor="end">oggi</text>
    </svg>
  )
}

// ── Word cloud ────────────────────────────────────────────────────────────────
function WordCloud({ themes }) {
  if (!themes || themes.length === 0) {
    return <div style={{ textAlign: 'center', color: '#444', fontSize: '0.8em', padding: '20px 0' }}>Nessun tema ancora — continua a usare il Psicologo AI!</div>
  }
  const max = themes.length
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', justifyContent: 'center', padding: '8px 0 16px' }}>
      {themes.map((t, i) => {
        const size = 0.7 + (1 - i / max) * 0.6
        const opacity = 0.5 + (1 - i / max) * 0.5
        return (
          <span key={i} style={{ fontSize: `${size}em`, opacity, color: 'var(--theme-color)', fontWeight: i < 3 ? 700 : 500, lineHeight: 1.4 }}>
            {t}
          </span>
        )
      })}
    </div>
  )
}

// ── Sessions list ─────────────────────────────────────────────────────────────
function SessionsList({ sessions }) {
  const [expanded, setExpanded] = useState(null)
  const sorted = [...sessions].reverse()
  if (sorted.length === 0) {
    return <div style={{ textAlign: 'center', color: '#444', fontSize: '0.8em', padding: '24px 0' }}>Nessuna sessione completata</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((s, i) => (
        <div key={s.id || i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: '0.8em' }}>{s.date}</span>
            <span style={{ fontSize: '0.75em', color: 'var(--text-sec)' }}>{s.messageCount} msg · €{(s.totalCostEUR || 0).toFixed(4)}</span>
            <span style={{ fontSize: '0.7em', color: '#444' }}>{expanded === i ? '▲' : '▼'}</span>
          </button>
          {expanded === i && (
            <div style={{ padding: '0 14px 12px', fontSize: '0.75em', color: '#555', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>Modello: {s.model}</div>
              <div>Token: {(s.totalTokens || 0).toLocaleString()}</div>
              {s.words && <div>Parole: {s.words}</div>}
              {s.durationSeconds && <div>Durata: {fmtTime(s.durationSeconds)}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────
export default function PsychStatsDrawer({ onClose, psychStats, psychSessions, psychProfile, todayWords, todayTimeSeconds, todayActiveSeconds }) {
  const [tab, setTab] = useState(0)
  const TABS = ['Oggi/Lifetime', 'Nel tempo', 'Temi', 'Sessioni']

  const ps = psychStats || {}
  const dailyStats = ps.dailyStats || {}
  const today = toDateString(new Date())
  const todayFire = dailyStats[today] || {}

  // Merge in-memory today stats with Firestore (in-memory is more recent)
  const todayWordsTotal = (todayFire.words || 0) + todayWords
  const todayTimeSec = (todayFire.timeSeconds || 0) + todayTimeSeconds
  const todayActiveSec = (todayFire.activeTimeSeconds || 0) + todayActiveSeconds
  const todayMessages = todayFire.messages || 0
  const todayCost = todayFire.costEUR || 0

  const lifetimeWords = (ps.totalWordsLifetime || 0) + todayWords
  const lifetimeTime = (ps.totalTimeSecondsLifetime || 0) + todayTimeSeconds
  const currentStreak = ps.currentStreak || 0
  const longestStreak = ps.longestStreak || 0
  const totalSessions = ps.totalSessions || 0

  const themes = ps.topThemes || []

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000 }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10001,
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1em' }}>📊 Statistiche</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', fontSize: '1.2em', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              style={{ background: tab === i ? 'var(--theme-color)' : 'rgba(255,255,255,0.06)', border: 'none', color: tab === i ? '#000' : 'var(--text-sec)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78em', fontWeight: tab === i ? 700 : 400, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* ── Tab 0: Oggi / Lifetime ── */}
          {tab === 0 && (
            <div>
              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Oggi</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <StatCard label="✍️ Parole scritte" value={todayWordsTotal.toLocaleString()} />
                <StatCard label="⏱ Tempo totale" value={fmtTime(todayTimeSec)} />
                <StatCard label="🎯 Tempo attivo" value={fmtTime(todayActiveSec)} sub="scrittura + attesa" />
                <StatCard label="💬 Messaggi" value={todayMessages} sub={`€${todayCost.toFixed(4)}`} />
              </div>

              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lifetime</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <StatCard label="✍️ Parole totali" value={lifetimeWords.toLocaleString()} />
                <StatCard label="⏱ Tempo totale" value={fmtTime(lifetimeTime)} />
                <StatCard label="📅 Sessioni" value={totalSessions} />
                <StatCard label="💬 Messaggi" value={(ps.totalMessages || 0).toLocaleString()} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCard label="🔥 Streak attuale" value={`${currentStreak} gg`} color={currentStreak > 0 ? 'var(--theme-color)' : undefined} />
                <StatCard label="🏆 Record streak" value={`${longestStreak} gg`} />
              </div>
            </div>
          )}

          {/* ── Tab 1: Nel tempo ── */}
          {tab === 1 && (
            <div>
              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Attività — ultime 30 settimane</div>
              <Heatmap dailyStats={dailyStats} />

              <div style={{ fontSize: '0.72em', color: '#555', marginTop: 20, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Media per giorno della settimana</div>
              <WeekdayChart dailyStats={dailyStats} />

              <div style={{ fontSize: '0.72em', color: '#555', marginTop: 20, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ultimi 30 giorni</div>
              <LineChart dailyStats={dailyStats} />
            </div>
          )}

          {/* ── Tab 2: Temi ── */}
          {tab === 2 && (
            <div>
              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Temi emergenti {psychProfile?.lastUpdated ? `· aggiornato ${new Date(psychProfile.lastUpdated).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}
              </div>
              <WordCloud themes={themes} />
              {themes.length > 0 && (
                <>
                  <div style={{ fontSize: '0.72em', color: '#555', margin: '16px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top temi</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {themes.slice(0, 10).map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.7em', color: '#444', width: 18, textAlign: 'right' }}>#{i + 1}</span>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 12px', fontSize: '0.82em', color: 'var(--text)' }}>{t}</div>
                        <div style={{ width: `${Math.max(8, (1 - i / 10) * 60)}px`, height: 4, background: 'var(--theme-color)', borderRadius: 2, opacity: 0.7 }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab 3: Sessioni ── */}
          {tab === 3 && (
            <div>
              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {psychSessions.length} sessioni registrate
              </div>
              <SessionsList sessions={psychSessions} />
            </div>
          )}

        </div>
      </div>
    </>
  )
}
