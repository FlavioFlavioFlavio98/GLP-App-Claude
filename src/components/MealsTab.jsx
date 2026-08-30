import { useState, useEffect, useRef, useMemo } from 'react'
import { computeMealWeekStats, getMealHistory, getMealRate, setMealRate, MEAL_LEVELS, getMealQuote } from '../lib/mealStats'
import { toDateString } from '../lib/habitLogic'
import ActivityRateEditor from './ActivityRateEditor'

const REMINDER_INTERVAL_MS = 45_000

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function fmtTime(time) {
  return (time || '').slice(0, 5)
}

function fmtElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function StatCell({ label, value, color, sub, subColor }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || 'var(--theme-color)' }}>
        {value}{sub && <span style={{ fontSize: '0.5em', fontWeight: 700, color: subColor || '#888', marginLeft: 4 }}>{sub}</span>}
      </div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

export default function MealsTab({ globalData, authUserId, isReadOnly, actions }) {
  const [sessionActive, setSessionActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showLevelPicker, setShowLevelPicker] = useState(false)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [showHistory, setShowHistory] = useState(false)

  const tickRef = useRef(null)
  const reminderRef = useRef(null)
  const wakeLockRef = useRef(null)

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch { /* non disponibile/negato — la sessione funziona comunque */ }
  }
  async function releaseWakeLock() {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release() } catch { /* ignore */ }
      wakeLockRef.current = null
    }
  }

  // Il wake lock del browser si rilascia automaticamente quando l'app va in
  // background — va richiesto di nuovo al ritorno, altrimenti lo schermo si
  // spegne a metà pasto se si cambia app un attimo.
  useEffect(() => {
    function onVisibility() {
      if (sessionActive && document.visibilityState === 'visible') acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [sessionActive])

  // Cleanup se si cambia tab/si chiude l'app a sessione attiva
  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (reminderRef.current) clearInterval(reminderRef.current)
    releaseWakeLock()
  }, [])

  function startSession() {
    setElapsed(0)
    setSessionActive(true)
    acquireWakeLock()
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    reminderRef.current = setInterval(() => {
      actions.vibrate('heavy')
      actions.showToast('🐢 Rallenta, mastica bene', '🐢')
    }, REMINDER_INTERVAL_MS)
  }

  function endSession() {
    if (tickRef.current) clearInterval(tickRef.current)
    if (reminderRef.current) clearInterval(reminderRef.current)
    releaseWakeLock()
    setSessionActive(false)
    setPendingDuration(Math.max(1, Math.round(elapsed / 60)))
    setShowLevelPicker(true)
  }

  function pickLevel(level) {
    actions.logMeal(pendingDuration, level)
    setShowLevelPicker(false)
    setElapsed(0)
  }

  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const mealLog = globalData?.mealLog || {}
  const stats = computeMealWeekStats(mealLog)
  const history = getMealHistory(mealLog)
  const today = toDateString(new Date())
  // useMemo cablato sui minuti trascorsi: la citazione ruota ogni minuto
  // (vedi getMealQuote) senza rigenerarsi ad ogni singolo render.
  const quote = useMemo(() => getMealQuote(), [Math.floor(Date.now() / 60000)])

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
            🍽️ Pasti consapevoli
          </div>
          <ActivityRateEditor getRate={getMealRate} setRate={setMealRate} unit="pt/min" label="Punti base al minuto" />
        </div>

        <div style={{
          fontSize: '0.78em', color: 'var(--text-sec)', fontStyle: 'italic', lineHeight: 1.4,
          padding: '10px 12px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--theme-color)',
        }}>
          "{quote}"
        </div>

        {!sessionActive && !showLevelPicker && (
          <button
            onClick={startSession}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '16px 14px', marginBottom: 12,
              background: 'var(--theme-color)', border: 'none',
              borderRadius: 12, cursor: 'pointer', color: '#000',
              fontSize: '1em', fontWeight: 800,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 22 }}>restaurant</span>
            Inizia pasto
          </button>
        )}

        {sessionActive && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '3em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmtElapsed(elapsed)}
            </div>
            <div style={{ fontSize: '0.72em', color: '#888', marginTop: 6, marginBottom: 16 }}>
              🐢 Ti ricordo di rallentare ogni 45 secondi — posa le posate tra un boccone e l'altro
            </div>
            <button
              onClick={endSession}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--danger, #e53935)', color: '#fff', fontSize: '1em', fontWeight: 800, cursor: 'pointer',
              }}
            >
              Fine pasto
            </button>
          </div>
        )}

        {showLevelPicker && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ textAlign: 'center', fontSize: '0.85em', color: 'var(--text-sec)', marginBottom: 10 }}>
              Durata: <strong style={{ color: 'var(--theme-color)' }}>{pendingDuration} min</strong> — quanto sei stato calmo?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {MEAL_LEVELS.map(lvl => (
                <button
                  key={lvl.level}
                  onClick={() => pickLevel(lvl.level)}
                  style={{
                    flex: 1, padding: '12px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontSize: '1.3em', marginBottom: 2 }}>{lvl.emoji}</div>
                  <div style={{ fontSize: '0.72em', fontWeight: 700 }}>{lvl.label}</div>
                  <div style={{ fontSize: '0.58em', color: '#777', marginTop: 2 }}>{lvl.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          <StatCell label="Ultimi 7gg" value={stats.total} />
          <StatCell label="Streak" value={`${stats.streak}g`} color={stats.streak > 0 ? 'var(--success, #4caf50)' : undefined} />
          <StatCell label="Record streak" value={`${stats.bestStreak}g`} />
          <StatCell
            label="Media min."
            value={stats.avgDuration || '–'}
            sub={stats.durationTrend != null && stats.durationTrend !== 0
              ? (stats.durationTrend > 0 ? `▲ +${stats.durationTrend}` : `▼ ${stats.durationTrend}`)
              : null}
            subColor={stats.durationTrend > 0 ? '#4caf50' : (stats.durationTrend < 0 ? '#e53935' : undefined)}
          />
          <StatCell label="Con calma" value={`${stats.calmPct}%`} color="#4caf50" />
          <StatCell label="Pasto più lungo" value={stats.longestMeal ? `${stats.longestMeal}m` : '–'} />
          <StatCell label="Punti 7gg" value={`+${stats.netPts}`} />
          <StatCell label="Totale pasti" value={stats.lifetimeTotal} />
        </div>

        {history.length > 0 && (
          <>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                color: 'var(--text-sec)', fontSize: '0.72em', fontWeight: 700, cursor: 'pointer',
                padding: '6px 2px', textTransform: 'uppercase', letterSpacing: 0.4,
              }}
            >
              {showHistory ? '▾' : '▸'} Storico pasti ({history.length})
            </button>
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                {history.map(e => {
                  const lvl = MEAL_LEVELS.find(l => l.level === e.level) || MEAL_LEVELS[1]
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                      <span style={{ fontSize: '1em' }}>{lvl.emoji}</span>
                      <span style={{ fontSize: '0.75em', color: 'var(--text-sec)', flex: 1 }}>
                        {e.date === today ? 'Oggi' : fmtDate(e.date)} · {fmtTime(e.time)}
                      </span>
                      <span style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--theme-color)' }}>{e.durationMin} min</span>
                      <span style={{ fontSize: '0.72em', color: 'var(--success)' }}>+{e.pts}pt</span>
                      <button
                        className="btn-icon"
                        style={{ padding: 2 }}
                        onClick={() => { const { date, ...original } = e; actions.deleteMealEntry(date, original) }}
                      >
                        <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
