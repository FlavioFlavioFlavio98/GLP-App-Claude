import { useState } from 'react'
import ScoreSparkline from './ScoreSparkline'
import AnimatedNumber from './AnimatedNumber'
import { countPerfectDays } from '../lib/habitLogic'

const STORAGE_KEY = 'glp_summary_expanded'

function DailySumRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
      <span style={{ fontSize: '0.72em', color: '#888' }}>{label}</span>
      <span style={{ fontSize: bold ? '0.82em' : '0.75em', color, fontWeight: bold ? 800 : 600 }}>{value}</span>
    </div>
  )
}

export default function DailySummaryPanel({
  authUserId, globalData,
  totalHabitPoints, taskPts, extraPts, checkInPts, readingPts,
  purchaseCost, penaltyCost, expiredTaskCost, trackedItems,
  dailySpent, habitCoinsNet, net, buildInfo,
}) {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')

  function toggle() {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  // Punteggio GENERALE (task/allenamento/diario/letture/check-in) — le
  // abitudini NON ci sono più dentro, sono i coin a parte qui sotto
  // (richiesta esplicita di Flavio, 29/9/2026, per non mischiare le due cose).
  const totalGain = taskPts + extraPts + checkInPts + readingPts
  const totalCost = expiredTaskCost
  const netColor = net < 0 ? '#e53935' : net === 0 ? '#EF9F27' : '#4caf50'
  const coinColor = habitCoinsNet < 0 ? '#e53935' : habitCoinsNet === 0 ? '#EF9F27' : '#4caf50'

  return (
    <div style={{ margin: '8px 0' }}>
      {/* ── RIGA COMPATTA (sempre visibile, tap per espandere/richiudere) ── */}
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10,
          padding: '8px 12px', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap', rowGap: 4,
        }}
      >
        <span style={{ fontSize: '0.8em', fontWeight: 700, color: '#4caf50', whiteSpace: 'nowrap' }}>↑ +{totalGain}</span>
        <span style={{ fontSize: '0.8em', fontWeight: 700, color: '#e53935', whiteSpace: 'nowrap' }}>↓ -{totalCost}</span>
        <span style={{ width: 1, height: 14, background: 'var(--card-border)' }} />
        <span style={{ fontSize: '0.85em', fontWeight: 800, color: netColor, whiteSpace: 'nowrap' }}>
          Netto: {net > 0 ? '+' : ''}{net}pt
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--card-border)' }} />
        <span style={{ fontSize: '0.85em', fontWeight: 800, color: coinColor, whiteSpace: 'nowrap' }}>
          🪙 {habitCoinsNet > 0 ? '+' : ''}{habitCoinsNet}
        </span>
        <span style={{ flex: 1 }} />
        <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text-sec)' }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* ── PANNELLO ESPANSO ── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 1000 : 0,
          opacity: expanded ? 1 : 0,
          transition: 'max-height 280ms ease, opacity 220ms ease',
        }}
      >
        <div style={{ paddingTop: 8 }}>
          {authUserId === 'flavio' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.62em', fontWeight: 700, color: '#4caf50', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>💚 Guadagni</div>
                  {taskPts > 0 && <DailySumRow label="Task 📋" value={`+${taskPts}`} color="#4caf50" />}
                  {extraPts > 0 && <DailySumRow label="Extra 💪" value={`+${extraPts}`} color="#4caf50" />}
                  {checkInPts > 0 && <DailySumRow label="Check-in ✅" value={`+${checkInPts}`} color="#4caf50" />}
                  {readingPts > 0 && <DailySumRow label="Letture 📚" value={`+${readingPts}`} color="#4caf50" />}
                  {totalGain === 0 && <div style={{ fontSize: '0.7em', color: '#444', fontStyle: 'italic' }}>Nessun guadagno</div>}
                  <div style={{ borderTop: '1px solid rgba(76,175,80,0.2)', marginTop: 4, paddingTop: 4 }}>
                    <DailySumRow label="Totale" value={`+${totalGain}`} color="#4caf50" bold />
                  </div>
                </div>
                <div style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.62em', fontWeight: 700, color: '#e53935', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🔴 Costi</div>
                  <DailySumRow label="Task scad." value={`-${expiredTaskCost}`} color={expiredTaskCost > 0 ? '#e53935' : '#3a3a3a'} />
                  {totalCost === 0 && <div style={{ fontSize: '0.7em', color: '#444', fontStyle: 'italic' }}>Nessun costo</div>}
                  <div style={{ borderTop: '1px solid rgba(229,57,53,0.2)', marginTop: 4, paddingTop: 4 }}>
                    <DailySumRow label="Totale" value={`-${totalCost}`} color="#e53935" bold />
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{ fontSize: '0.58em', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>NETTO OGGI</div>
                <span key={net} className="netto-animated" style={{ fontWeight: 800, fontSize: '2.2em', color: netColor }}>
                  {net > 0 ? '+' : ''}{net}pt
                </span>
              </div>

              {/* ── Coin Abitudini: SEPARATO dal punteggio generale sopra — si
                  spende nel Negozio Premi, confrontato tra Flavio e Simona
                  (richiesta esplicita di Flavio, 29/9/2026). ── */}
              <div style={{ background: 'rgba(255,202,40,0.08)', border: '1px solid rgba(255,202,40,0.25)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                <div style={{ fontSize: '0.62em', fontWeight: 700, color: '#EF9F27', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🪙 Coin Abitudini — oggi</div>
                {totalHabitPoints > 0 && <DailySumRow label="Guadagnati" value={`+${totalHabitPoints}`} color="#4caf50" />}
                {penaltyCost > 0 && <DailySumRow label="Penalità" value={`-${penaltyCost}`} color="#e53935" />}
                {purchaseCost > 0 && <DailySumRow label="Premi" value={`-${purchaseCost}`} color="#e53935" />}
                {trackedItems.filter(ti => ti.cost > 0).map(ti => (
                  <DailySumRow key={ti.id} label={ti.name} value={`-${ti.cost}`} color="#e53935" />
                ))}
                {totalHabitPoints === 0 && penaltyCost === 0 && purchaseCost === 0 && trackedItems.every(ti => !ti.cost) && (
                  <div style={{ fontSize: '0.7em', color: '#444', fontStyle: 'italic' }}>Nessun movimento</div>
                )}
                <div style={{ borderTop: '1px solid rgba(255,202,40,0.25)', marginTop: 4, paddingTop: 4 }}>
                  <DailySumRow label="Netto coin" value={`${habitCoinsNet > 0 ? '+' : ''}${habitCoinsNet}`} color={coinColor} bold />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
                  <ScoreSparkline habits={globalData?.habits} rewards={globalData?.rewards} dailyLogs={globalData?.dailyLogs} />
                  {(() => { const pd = countPerfectDays(globalData?.habits, globalData?.dailyLogs); return pd > 0 ? <span style={{ fontSize: '0.72em', color: '#ffd700', fontWeight: 700 }}>⭐ {pd} giorni perfetti</span> : null })()}
                </div>
              </div>
            </>
          ) : (
            <div className="daily-summary">
              <div className="sum-item">
                <div className="sum-label">🪙 Guadagnati</div>
                <AnimatedNumber value={totalHabitPoints} className="sum-val sum-earn" prefix="+" />
              </div>
              <div className="sum-item">
                <div className="sum-label">🪙 Spesi/Pen</div>
                <AnimatedNumber value={dailySpent} className="sum-val sum-spent" prefix="-" />
              </div>
              <div className="sum-item">
                <div className="sum-label">🪙 Netto coin</div>
                <AnimatedNumber value={habitCoinsNet} className={`sum-val ${habitCoinsNet < 0 ? 'net-neg' : habitCoinsNet < 10 ? 'net-warn' : 'net-pos'}`} prefix={habitCoinsNet > 0 ? '+' : ''} />
              </div>
            </div>
          )}

          {buildInfo}
        </div>
      </div>
    </div>
  )
}
