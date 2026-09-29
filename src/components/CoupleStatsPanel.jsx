import { useEffect, useMemo, useRef } from 'react'
import { useApp } from '../lib/store'
import { Chart } from '../lib/chartSetup'
import { toDateString } from '../lib/habitLogic'
import { computeCoupleStats } from '../lib/coupleStats'
import { USER_LABEL } from '../lib/partnerHabits'

// Statistiche di coppia, calcolate sulle sole abitudini (vedi lib/coupleStats).
// Caricato in lazy solo quando si apre il toggle "Statistiche di coppia".

const ORDER = ['flavio', 'simona']

function Card({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ fontSize: '0.62em', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function TwoCols({ left, right }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{left}{right}</div>
}

function Big({ color, value, sub }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.4em', fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.62em', color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function fmtPts(n) { return `${n > 0 ? '+' : ''}${n}🪙` }

export default function CoupleStatsPanel({ people }) {
  const { state } = useApp()
  const { userColors } = state
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const todayStr = toDateString(new Date())

  const ordered = useMemo(() => ORDER.map(id => people.find(p => p.id === id)).filter(Boolean), [people])
  const stats = useMemo(() => (ordered.length === 2 ? computeCoupleStats(ordered, todayStr) : null), [ordered, todayStr])
  const color = id => userColors[id] || (id === 'flavio' ? '#ffca28' : '#d05ce3')

  useEffect(() => {
    if (!stats || !canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: stats.trend.labels.map(d => `${parseInt(d.slice(8))}/${parseInt(d.slice(5, 7))}`),
        datasets: ORDER.map(id => ({
          label: USER_LABEL[id], data: stats.trend[id].pct, borderColor: color(id), backgroundColor: color(id),
          borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#888', boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw ?? '–'}%` } } },
        scales: {
          y: { min: 0, max: 100, grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: '#888', callback: v => `${v}%` } },
          x: { grid: { display: false }, ticks: { color: '#888', maxTicksLimit: 6 } },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  if (!stats) return <div className="empty-state" style={{ fontSize: '0.82em' }}>Statistiche disponibili quando i dati di entrambi sono caricati</div>

  const P = stats.people
  const leader = stats.joint.leader

  return (
    <div style={{ marginBottom: 14 }}>
      <Card title="Streak — giorni perfetti di fila">
        <TwoCols
          left={<Big color={color('flavio')} value={`${P.flavio.streak}g`} sub="Flavio" />}
          right={<Big color={color('simona')} value={`${P.simona.streak}g`} sub="Simona" />}
        />
        <div style={{ textAlign: 'center', fontSize: '0.72em', color: 'var(--text-sec)', marginTop: 8 }}>
          💞 Insieme: <b>{stats.joint.streak}g</b> di fila · <b>{stats.joint.perfect30}</b> giorni perfetti su 30
        </div>
      </Card>

      <Card title="Classifica della settimana (coin abitudini)">
        <TwoCols
          left={<Big color={color('flavio')} value={`${leader === 'flavio' ? '🏆 ' : ''}${fmtPts(P.flavio.week)}`} sub={`Flavio · scorsa ${fmtPts(P.flavio.lastWeek)}`} />}
          right={<Big color={color('simona')} value={`${leader === 'simona' ? '🏆 ' : ''}${fmtPts(P.simona.week)}`} sub={`Simona · scorsa ${fmtPts(P.simona.lastWeek)}`} />}
        />
        <div style={{ textAlign: 'center', fontSize: '0.72em', color: 'var(--text-sec)', marginTop: 8 }}>
          {leader ? `${USER_LABEL[leader]} è avanti di ${stats.joint.weekGap} coin` : 'Pari questa settimana'}
        </div>
      </Card>

      <Card title="Completamento abitudini">
        <TwoCols
          left={<Big color={color('flavio')} value={P.flavio.pct7 == null ? '–' : `${P.flavio.pct7}%`} sub={`Flavio · 7gg (30gg: ${P.flavio.pct30 == null ? '–' : P.flavio.pct30 + '%'})`} />}
          right={<Big color={color('simona')} value={P.simona.pct7 == null ? '–' : `${P.simona.pct7}%`} sub={`Simona · 7gg (30gg: ${P.simona.pct30 == null ? '–' : P.simona.pct30 + '%'})`} />}
        />
        <div style={{ height: 150, marginTop: 10, position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
      </Card>

      <Card title="Più costante / più fallita (ultimi 30 giorni)">
        <TwoCols
          left={<Insight name="Flavio" color={color('flavio')} ins={P.flavio.insight} />}
          right={<Insight name="Simona" color={color('simona')} ins={P.simona.insight} />}
        />
      </Card>
    </div>
  )
}

function Insight({ name, color, ins }) {
  return (
    <div style={{ fontSize: '0.74em', lineHeight: 1.5 }}>
      <div style={{ fontWeight: 700, color, marginBottom: 2 }}>{name}</div>
      <div>✅ {ins.mostConsistent ? <>{ins.mostConsistent.name} <span style={{ color: '#888' }}>({ins.mostConsistent.pct}%)</span></> : <span style={{ color: '#888' }}>–</span>}</div>
      <div>❌ {ins.mostFailed ? <>{ins.mostFailed.name} <span style={{ color: '#888' }}>({ins.mostFailed.fails}×)</span></> : <span style={{ color: '#888' }}>nessuna</span>}</div>
    </div>
  )
}
