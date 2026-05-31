import { useMemo } from 'react'
import { useApp } from '../lib/store'
import {
  hasEnoughData, buildFailureCorrelations, buildDoneCorrelations,
  buildDayOfWeekPattern, buildTrend30, buildCriticalHabits, buildCategoryBalance,
} from '../lib/insightLogic'
import { buildImportanceInsights, buildEnergyCorrelations } from '../lib/statsLogic'

function InsightCard({ icon, title, value, sub, color = 'var(--theme-color)' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.4em', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.78em', color: '#666', marginBottom: 4 }}>{title}</div>
          <div style={{ fontWeight: 700, color, fontSize: '1em' }}>{value}</div>
          {sub && <div style={{ fontSize: '0.72em', color: '#555', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.65em', color: '#555', textTransform: 'uppercase',
      letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, marginTop: 20,
    }}>{children}</div>
  )
}

export default function InsightModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'insights') return null
  if (!globalData) return null

  const enough = hasEnoughData(globalData)

  const impInsights = useMemo(() => buildImportanceInsights(globalData), [globalData, modal])
  const energyCorr = useMemo(() => buildEnergyCorrelations(globalData, currentUser, 60), [globalData, modal])
  const failCorr = useMemo(() => enough ? buildFailureCorrelations(globalData) : [], [globalData, modal])
  const doneCorr = useMemo(() => enough ? buildDoneCorrelations(globalData) : [], [globalData, modal])
  const dowPattern = useMemo(() => enough ? buildDayOfWeekPattern(globalData) : null, [globalData, modal])
  const trend30 = useMemo(() => enough ? buildTrend30(globalData) : null, [globalData, modal])
  const critical = useMemo(() => enough ? buildCriticalHabits(globalData) : null, [globalData, modal])
  const catBalance = useMemo(() => enough ? buildCategoryBalance(globalData) : [], [globalData, modal])

  const trendArrow = trend30?.direction === 'crescita' ? '↑' : trend30?.direction === 'calo' ? '↓' : '→'
  const trendColor = trend30?.direction === 'crescita' ? 'var(--success)' : trend30?.direction === 'calo' ? 'var(--danger)' : '#888'

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.15em', color: 'var(--theme-color)', flex: 1 }}>
          💡 Insight
        </h1>
      </div>

      <div className="single-habit-body">
        {!enough && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
            <div style={{ fontSize: '3em', marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Servono più dati</div>
            <div style={{ fontSize: '0.85em' }}>
              Usa l'app per almeno 14 giorni per sbloccare gli insight.
            </div>
          </div>
        )}

        {enough && (
          <>
            {/* Importance insights */}
            {impInsights.failedNames.length > 0 && (
              <>
                <SectionLabel>Abitudini Importanti</SectionLabel>
                <InsightCard
                  icon="🔴"
                  title="Abitudini ad alta importanza fallite questa settimana"
                  value={`${impInsights.failedNames.length} abitudine${impInsights.failedNames.length > 1 ? 'i' : ''}`}
                  sub={impInsights.failedNames.slice(0, 3).join(', ')}
                  color="var(--danger)"
                />
                {impInsights.winRate !== null && (
                  <InsightCard
                    icon="💪"
                    title="Win rate abitudini ad alta importanza (7gg)"
                    value={`${impInsights.winRate}%`}
                    sub={`${impInsights.weekDone} / ${impInsights.weekTotal} completamenti`}
                    color={impInsights.winRate >= 70 ? 'var(--success)' : 'var(--danger)'}
                  />
                )}
              </>
            )}

            {/* Energy insights */}
            {energyCorr.avgMorning !== null && (
              <>
                <SectionLabel>Energia</SectionLabel>
                <InsightCard
                  icon="⚡"
                  title="Energia mattutina media"
                  value={`${energyCorr.avgMorning}/3`}
                  sub={`Serale: ${energyCorr.avgEvening ?? '-'}/3 · Giorno top: ${energyCorr.bestDOW}`}
                  color="#EF9F27"
                />
                {energyCorr.morningToWinRate[2]?.avgWinRate !== null && energyCorr.morningToWinRate[0]?.avgWinRate !== null && (
                  <InsightCard
                    icon="📊"
                    title="Con energia alta completi in media"
                    value={`${energyCorr.morningToWinRate[2]?.avgWinRate}% abitudini`}
                    sub={`vs ${energyCorr.morningToWinRate[0]?.avgWinRate}% con energia bassa`}
                    color="var(--success)"
                  />
                )}
              </>
            )}

            {/* Trend 30gg */}
            <SectionLabel>Trend</SectionLabel>
            {trend30 && (
              <InsightCard
                icon={trendArrow}
                title="Tendenza ultimi 30 giorni"
                value={`${trend30.direction === 'crescita' ? '+' : trend30.direction === 'calo' ? '-' : ''}${Math.abs(trend30.pct)}% ${trend30.direction}`}
                sub={`Media recente: ${trend30.recentAvg > 0 ? '+' : ''}${trend30.recentAvg}/gg  ·  Prec.: ${trend30.prevAvg > 0 ? '+' : ''}${trend30.prevAvg}/gg`}
                color={trendColor}
              />
            )}

            {/* Pattern temporali */}
            <SectionLabel>Pattern Temporali</SectionLabel>
            {dowPattern && (
              <>
                <InsightCard
                  icon="📅"
                  title="Miglior giorno della settimana"
                  value={dowPattern.bestDay}
                  sub={`Media punti netti: ${dowPattern.bestAvg > 0 ? '+' : ''}${dowPattern.bestAvg}`}
                  color="var(--success)"
                />
                {dowPattern.worstDay !== dowPattern.bestDay && (
                  <InsightCard
                    icon="😓"
                    title="Giorno più difficile"
                    value={dowPattern.worstDay}
                    sub={`Media punti netti: ${dowPattern.worstAvg > 0 ? '+' : ''}${dowPattern.worstAvg}`}
                    color="var(--danger)"
                  />
                )}
              </>
            )}

            {/* Abitudini critiche */}
            <SectionLabel>Abitudini Critiche</SectionLabel>
            {critical && (
              <>
                {critical.highest && (
                  <InsightCard
                    icon="⚡"
                    title="Abitudine con più impatto"
                    value={critical.highest.name}
                    sub={`Vale il ${critical.highest.pct}% del potenziale giornaliero`}
                    color="var(--theme-color)"
                  />
                )}
                {critical.lowestWinRate && (
                  <InsightCard
                    icon="⚠️"
                    title="Abitudine con win rate più basso"
                    value={`${critical.lowestWinRate.name} — ${critical.lowestWinRate.winRate}%`}
                    sub={`${critical.lowestWinRate.attempts} tentativi`}
                    color="var(--danger)"
                  />
                )}
                {critical.lowWinRateCount > 0 && (
                  <InsightCard
                    icon="🔻"
                    title="Abitudini sotto il 50% win rate"
                    value={`${critical.lowWinRateCount} abitudine${critical.lowWinRateCount > 1 ? 'i' : ''}`}
                    sub="Considera di rivederle o ridurre la difficoltà"
                    color="#EF9F27"
                  />
                )}
              </>
            )}

            {/* Correlazioni fallimenti */}
            {failCorr.length > 0 && (
              <>
                <SectionLabel>Correlazioni — Fallimenti</SectionLabel>
                {failCorr.map(({ a, b, rate }, i) => (
                  <InsightCard
                    key={i}
                    icon="🔗"
                    title="Quando fallisci questa…"
                    value={`"${a}" → "${b}"`}
                    sub={`Co-occorrenza fallimenti: ${rate}%`}
                    color="var(--danger)"
                  />
                ))}
              </>
            )}

            {/* Correlazioni completamenti */}
            {doneCorr.length > 0 && (
              <>
                <SectionLabel>Correlazioni — Completamenti</SectionLabel>
                {doneCorr.map(({ a, b, rate }, i) => (
                  <InsightCard
                    key={i}
                    icon="✨"
                    title="Quando completi questa…"
                    value={`"${a}" → "${b}"`}
                    sub={`Co-occorrenza completamenti: ${rate}%`}
                    color="var(--success)"
                  />
                ))}
              </>
            )}

            {/* Equilibrio categorie */}
            {catBalance.length > 0 && (
              <>
                <SectionLabel>Equilibrio Categorie</SectionLabel>
                {catBalance[0]?.pct > 50 && (
                  <InsightCard
                    icon="⚖️"
                    title="Categoria dominante"
                    value={`${catBalance[0].name} — ${catBalance[0].pct}% dei punti`}
                    sub="Considera di diversificare le tue abitudini"
                    color={catBalance[0].color}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {catBalance.slice(0, 5).map(({ name, color, pct }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82em' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{name}</span>
                      <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
