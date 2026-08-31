import { useState, useEffect, useRef } from 'react'
import {
  computeMealWeekStats, getMealHistory, getMealRate, setMealRate, MEAL_LEVELS, getMealQuote,
  getMealTarget, setMealTarget, MEAL_TARGET_OPTIONS, getEatingTip,
  getUntrackedMealPenalty, setUntrackedMealPenalty,
} from '../lib/mealStats'
import { toDateString } from '../lib/habitLogic'
import ActivityRateEditor from './ActivityRateEditor'

const REMINDER_INTERVAL_MS = 45_000
// La sessione (orario di inizio + obiettivo) vive qui, non solo nello stato
// del componente: cambiare tab (il componente smonta, App.jsx renderizza un
// tab alla volta), mettere in background il browser/l'app, o persino
// chiuderla del tutto (kill del processo) azzerava il timer — bug reale
// segnalato da Flavio, che spesso guarda un video mentre mangia lentamente e
// non deve perdere la sessione. localStorage sopravvive a tutto questo;
// l'unico modo per fermare davvero la sessione resta il tasto "Fine pasto".
const MEAL_SESSION_KEY = 'glp_meal_session'
// Chiave del formato precedente (solo timestamp, senza obiettivo) — se una
// sessione era già in corso proprio nel momento di questo aggiornamento,
// senza questo fallback sarebbe sparita silenziosamente al primo reload,
// esattamente il bug che questo componente esiste apposta per evitare.
const LEGACY_MEAL_SESSION_KEY = 'glp_meal_session_start'

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

// Un'unica formula per scegliere quale trick mostrare, usata sia dal
// richiamo periodico (toast) sia dalla card sempre visibile durante la
// sessione — calcolarla in due punti separati rischierebbe di farle
// disallineare a un futuro cambio di REMINDER_INTERVAL_MS.
function tipIndexForElapsedSec(elapsedSec) {
  return Math.round((elapsedSec * 1000) / REMINDER_INTERVAL_MS)
}

function readSession() {
  // Lettura del nuovo formato isolata nel proprio try: un valore corrotto
  // qui non deve impedire il fallback al formato precedente subito sotto.
  try {
    const raw = localStorage.getItem(MEAL_SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const start = parsed?.start
      const target = parsed?.target
      if (typeof start === 'number' && !isNaN(start)) {
        return {
          start,
          target: (typeof target === 'number' && target > 0) ? target : getMealTarget(),
        }
      }
    }
  } catch { /* fallback al formato precedente qui sotto */ }

  // Fallback al formato precedente (solo timestamp) — migra al nuovo
  // formato per le letture successive, ma la sessione letta va restituita
  // comunque anche se il salvataggio della migrazione fallisse (es. storage
  // pieno/bloccato): un errore lì non deve far perdere una sessione valida
  // già letta con successo, altrimenti sarebbe di nuovo lo stesso bug che
  // questo componente esiste apposta per evitare.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_MEAL_SESSION_KEY)
    const legacyStart = legacyRaw ? parseInt(legacyRaw, 10) : NaN
    if (!isNaN(legacyStart)) {
      const migrated = { start: legacyStart, target: getMealTarget() }
      try {
        localStorage.setItem(MEAL_SESSION_KEY, JSON.stringify(migrated))
        localStorage.removeItem(LEGACY_MEAL_SESSION_KEY)
      } catch { /* la sessione letta resta comunque valida, si ritenterà la migrazione al prossimo mount */ }
      return migrated
    }
  } catch { /* ignore */ }

  return null
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

// Anello di progresso elapsed/obiettivo — l'elemento centrale "gioco" della
// sessione: si riempie e cambia colore man mano che ti avvicini
// all'obiettivo, invece di un timer che sale e basta senza un traguardo.
function ProgressRing({ elapsed, targetSeconds, reached }) {
  const size = 176
  const stroke = 12
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = targetSeconds > 0 ? Math.min(1, elapsed / targetSeconds) : 0
  const color = reached ? '#4caf50' : 'var(--theme-color)'

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '1.9em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {fmtElapsed(elapsed)}
        </div>
        <div style={{ fontSize: '0.62em', color: reached ? '#4caf50' : '#888', fontWeight: 700, marginTop: 4 }}>
          {reached ? '🎯 obiettivo raggiunto!' : `su ${Math.floor(targetSeconds / 60)} min`}
        </div>
      </div>
    </div>
  )
}

// Grafico minimale del tempo totale mangiato per giorno, ultimi 14 giorni —
// il numero unico che Flavio vuole veder salire nel tempo, non la durata di
// un pasto solo. Barre scalate al massimo visibile nella finestra.
function DailyTotalsChart({ dailyTotals }) {
  const max = Math.max(1, ...dailyTotals.map(d => d.totalMin))
  const todayStr = toDateString(new Date())
  const chartHeight = 56
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: chartHeight, marginTop: 4, marginBottom: 4 }}>
      {dailyTotals.map(d => {
        const h = d.totalMin > 0 ? Math.max(3, Math.round((d.totalMin / max) * chartHeight)) : 2
        const isToday = d.date === todayStr
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: chartHeight }} title={`${fmtDate(d.date)}: ${d.totalMin} min`}>
            <div style={{
              height: h, borderRadius: 3,
              background: isToday ? 'var(--theme-color)' : (d.totalMin > 0 ? 'rgba(255,202,40,0.35)' : 'rgba(255,255,255,0.08)'),
            }} />
          </div>
        )
      })}
    </div>
  )
}

export default function MealsTab({ globalData, authUserId, isReadOnly, actions }) {
  const [sessionActive, setSessionActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [target, setTarget] = useState(() => getMealTarget())
  const [pendingTarget, setPendingTarget] = useState(0)
  const [showLevelPicker, setShowLevelPicker] = useState(false)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  // Flusso "pasto non tracciato": null (chiuso) → 'count' (quanti pasti) →
  // 'reason' (perché non tracciati) — due passi separati invece di un unico
  // form, per tenere ogni schermata piccola e veloce da compilare.
  const [untrackedStep, setUntrackedStep] = useState(null)
  const [untrackedCount, setUntrackedCount] = useState(1)
  const [untrackedReason, setUntrackedReason] = useState('')

  const tickRef = useRef(null)
  const reminderRef = useRef(null)
  const wakeLockRef = useRef(null)
  const startTimeRef = useRef(null)
  const celebratedRef = useRef(false)

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

  function celebrateTarget() {
    if (celebratedRef.current) return
    celebratedRef.current = true
    actions.vibrate('heavy')
    actions.showToast('🎯 Obiettivo raggiunto! Continua con calma', '🎉')
    import('canvas-confetti').then(m => m.default({
      particleCount: 60, spread: 65, origin: { y: 0.6 },
      colors: ['#ffca28', '#4caf50'],
    })).catch(() => {})
  }

  // Avvia gli interval di tick/richiamo. Il tick ricalcola sempre l'elapsed
  // dall'orario di inizio reale (Date.now() - startTimeRef) invece di
  // incrementare un contatore: un tab in background può ritardare o saltare
  // dei tick del setInterval, ma al prossimo tick utile il valore si
  // autocorregge comunque al tempo vero trascorso, invece di restare indietro.
  function startTicking(targetMin) {
    if (tickRef.current) clearInterval(tickRef.current)
    if (reminderRef.current) clearInterval(reminderRef.current)
    tickRef.current = setInterval(() => {
      const now = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(now)
      if (now >= targetMin * 60) celebrateTarget()
    }, 1000)
    reminderRef.current = setInterval(() => {
      actions.vibrate('heavy')
      const nowSec = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const tip = getEatingTip(tipIndexForElapsedSec(nowSec))
      actions.showToast(`${tip.emoji} ${tip.text}`, tip.emoji)
    }, REMINDER_INTERVAL_MS)
  }

  // Al mount: riprende una sessione già in corso salvata in localStorage —
  // copre sia il rientro da un altro tab dell'app (il componente è stato
  // smontato e rimontato) sia la riapertura dell'app dopo che era stata
  // chiusa del tutto mentre il pasto era ancora in corso.
  useEffect(() => {
    const stored = readSession()
    if (stored) {
      startTimeRef.current = stored.start
      const now = Math.floor((Date.now() - stored.start) / 1000)
      setElapsed(now)
      setPendingTarget(stored.target)
      celebratedRef.current = now >= stored.target * 60
      setSessionActive(true)
      acquireWakeLock()
      startTicking(stored.target)
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (reminderRef.current) clearInterval(reminderRef.current)
      releaseWakeLock()
    }
  }, [])

  // Il wake lock del browser si rilascia automaticamente quando l'app va in
  // background — va richiesto di nuovo al ritorno, altrimenti lo schermo si
  // spegne a metà pasto se si cambia app un attimo. Approfittiamo anche del
  // rientro per far scattare subito l'elapsed al valore corretto, invece di
  // aspettare il prossimo tick del setInterval.
  useEffect(() => {
    function onVisibility() {
      if (sessionActive && document.visibilityState === 'visible') {
        acquireWakeLock()
        if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [sessionActive])

  function pickTarget(minutes) {
    setTarget(minutes)
    setMealTarget(minutes)
  }

  function startSession() {
    const start = Date.now()
    startTimeRef.current = start
    celebratedRef.current = false
    localStorage.setItem(MEAL_SESSION_KEY, JSON.stringify({ start, target }))
    setElapsed(0)
    setPendingTarget(target)
    setSessionActive(true)
    acquireWakeLock()
    startTicking(target)
  }

  function endSession() {
    if (tickRef.current) clearInterval(tickRef.current)
    if (reminderRef.current) clearInterval(reminderRef.current)
    releaseWakeLock()
    localStorage.removeItem(MEAL_SESSION_KEY)
    const finalElapsed = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : elapsed
    setSessionActive(false)
    setPendingDuration(Math.max(1, Math.round(finalElapsed / 60)))
    setShowLevelPicker(true)
  }

  function pickLevel(level) {
    actions.logMeal(pendingDuration, level, pendingTarget)
    setShowLevelPicker(false)
    setElapsed(0)
  }

  function openUntrackedFlow() {
    setUntrackedCount(1)
    setUntrackedReason('')
    setUntrackedStep('count')
  }

  function cancelUntrackedFlow() {
    setUntrackedStep(null)
  }

  function submitUntrackedMeals() {
    if (!untrackedReason.trim()) return
    actions.logUntrackedMeals(untrackedCount, untrackedReason)
    setUntrackedStep(null)
  }

  if (authUserId !== 'flavio' || isReadOnly) {
    return <div className="empty-state">Sezione non disponibile</div>
  }

  const mealLog = globalData?.mealLog || {}
  const stats = computeMealWeekStats(mealLog)
  const history = getMealHistory(mealLog)
  const today = toDateString(new Date())
  // Chiamata diretta, non un hook: ruota da sola ogni minuto (vedi
  // getMealQuote) semplicemente perché il componente si ri-renderizza spesso
  // durante una sessione attiva (il timer aggiorna lo stato ogni secondo).
  const quote = getMealQuote()
  const reached = elapsed >= pendingTarget * 60
  const currentTip = getEatingTip(tipIndexForElapsedSec(elapsed))

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

        {/* Hero: il numero che conta davvero — tempo totale mangiato oggi,
            con trend settimanale e grafico degli ultimi 14 giorni, per
            vedere a colpo d'occhio se sta salendo nel tempo. */}
        <div style={{
          borderRadius: 12, padding: '12px 14px', marginBottom: 12,
          background: 'linear-gradient(135deg, rgba(255,202,40,0.10), rgba(255,202,40,0.02))',
          border: '1px solid rgba(255,202,40,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.62em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Tempo mangiato oggi</div>
              <div style={{ fontSize: '1.7em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1.3 }}>
                {stats.todayTotalMin} min
                <span style={{ fontSize: '0.4em', color: '#888', fontWeight: 700, marginLeft: 6 }}>
                  {stats.todayMealCount} past{stats.todayMealCount === 1 ? 'o' : 'i'}
                </span>
                {stats.todayUntrackedCount > 0 && (
                  <span style={{ fontSize: '0.4em', color: '#e53935', fontWeight: 700, marginLeft: 6 }}>
                    ⚠️ {stats.todayUntrackedCount} non tracciat{stats.todayUntrackedCount === 1 ? 'o' : 'i'}
                  </span>
                )}
              </div>
            </div>
            {stats.weekTotalTrend != null && stats.weekTotalTrend !== 0 && (
              <div style={{
                fontSize: '0.68em', fontWeight: 800, padding: '4px 8px', borderRadius: 20,
                color: stats.weekTotalTrend > 0 ? '#4caf50' : '#e53935',
                background: stats.weekTotalTrend > 0 ? 'rgba(76,175,80,0.12)' : 'rgba(229,57,53,0.12)',
              }}>
                {stats.weekTotalTrend > 0 ? '▲' : '▼'} {Math.abs(stats.weekTotalTrend)} min vs sett. scorsa
              </div>
            )}
          </div>
          <DailyTotalsChart dailyTotals={stats.dailyTotals} />
        </div>

        {!sessionActive && !showLevelPicker && !untrackedStep && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.68em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 6 }}>
              🎯 Obiettivo di questo pasto
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {MEAL_TARGET_OPTIONS.map(min => (
                <button
                  key={min}
                  onClick={() => pickTarget(min)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    fontSize: '0.8em', fontWeight: 800,
                    background: target === min ? 'var(--theme-color)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${target === min ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
                    color: target === min ? '#000' : 'var(--text)',
                  }}
                >
                  {min}m
                </button>
              ))}
            </div>
            <button
              onClick={startSession}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '16px 14px', marginBottom: 10,
                background: 'var(--theme-color)', border: 'none',
                borderRadius: 12, cursor: 'pointer', color: '#000',
                fontSize: '1em', fontWeight: 800,
              }}
            >
              <span className="material-icons-round" style={{ fontSize: 22 }}>restaurant</span>
              Inizia pasto
            </button>
            <button
              onClick={openUntrackedFlow}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px', background: 'none', border: 'none', cursor: 'pointer',
                color: '#888', fontSize: '0.7em', fontWeight: 700,
              }}
            >
              ⚠️ Ho mangiato senza tracciare
            </button>
          </div>
        )}

        {untrackedStep === 'count' && (
          <div style={{ marginBottom: 12, padding: '14px', borderRadius: 12, background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ fontSize: '0.8em', color: 'var(--text-sec)', textAlign: 'center' }}>
                Quanti pasti hai mangiato oggi <strong>senza</strong> tracciarli?
              </div>
              <ActivityRateEditor getRate={getUntrackedMealPenalty} setRate={setUntrackedMealPenalty} unit="pt/pasto" label="Penalità per pasto non tracciato" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 14 }}>
              <button
                onClick={() => setUntrackedCount(c => Math.max(1, c - 1))}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '1.2em', cursor: 'pointer' }}
              >−</button>
              <div style={{ fontSize: '2em', fontWeight: 900, color: '#e53935', minWidth: 40, textAlign: 'center' }}>{untrackedCount}</div>
              <button
                onClick={() => setUntrackedCount(c => Math.min(10, c + 1))}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '1.2em', cursor: 'pointer' }}
              >+</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelUntrackedFlow} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#888', fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => setUntrackedStep('reason')} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#e53935', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Continua</button>
            </div>
          </div>
        )}

        {untrackedStep === 'reason' && (
          <div style={{ marginBottom: 12, padding: '14px', borderRadius: 12, background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.2)' }}>
            <div style={{ textAlign: 'center', fontSize: '0.8em', color: 'var(--text-sec)', marginBottom: 10 }}>
              Perché non li hai tracciati?
            </div>
            <textarea
              autoFocus
              value={untrackedReason}
              onChange={e => setUntrackedReason(e.target.value)}
              placeholder="es. ero con amici, mi sono dimenticato..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)', fontSize: '0.85em', resize: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: '0.68em', color: '#888', textAlign: 'center', marginBottom: 12 }}>
              Costerà <strong style={{ color: '#e53935' }}>-{Math.round(getUntrackedMealPenalty() * untrackedCount * 10) / 10}pt</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelUntrackedFlow} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#888', fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
              <button
                onClick={submitUntrackedMeals}
                disabled={!untrackedReason.trim()}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                  background: untrackedReason.trim() ? '#e53935' : 'rgba(229,57,53,0.3)',
                  color: '#fff', fontWeight: 800, cursor: untrackedReason.trim() ? 'pointer' : 'default',
                }}
              >
                Registra
              </button>
            </div>
          </div>
        )}

        {sessionActive && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <ProgressRing elapsed={elapsed} targetSeconds={pendingTarget * 60} reached={reached} />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: '0.76em', color: 'var(--text-sec)', margin: '14px 0 16px',
              padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
            }}>
              <span style={{ fontSize: '1.3em' }}>{currentTip.emoji}</span>
              <span>{currentTip.text}</span>
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
              Durata: <strong style={{ color: 'var(--theme-color)' }}>{pendingDuration} min</strong>
              {pendingTarget > 0 && (
                <span style={{ color: pendingDuration >= pendingTarget ? '#4caf50' : '#888' }}>
                  {' '}{pendingDuration >= pendingTarget ? `🎯 obiettivo ${pendingTarget}m centrato` : `(obiettivo era ${pendingTarget}m)`}
                </span>
              )}
              <br />quanto sei stato calmo?
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          <StatCell label="Streak" value={`${stats.streak}g`} color={stats.streak > 0 ? 'var(--success, #4caf50)' : undefined} />
          <StatCell label="Record streak" value={`${stats.bestStreak}g`} />
          <StatCell
            label="Media min."
            value={stats.avgDuration || '–'}
            sub={stats.durationTrend != null && stats.durationTrend !== 0
              ? (stats.durationTrend > 0 ? `▲ +${stats.durationTrend}` : `▼ ${Math.abs(stats.durationTrend)}`)
              : null}
            subColor={stats.durationTrend > 0 ? '#4caf50' : (stats.durationTrend < 0 ? '#e53935' : undefined)}
          />
          <StatCell label="Con calma" value={`${stats.calmPct}%`} color="#4caf50" />
          <StatCell label="Pasto più lungo" value={stats.longestMeal ? `${stats.longestMeal}m` : '–'} />
          {stats.targetHitPct != null && <StatCell label="Obiettivo centrato" value={`${stats.targetHitPct}%`} color="#4caf50" />}
          <StatCell label="Punti 7gg" value={stats.netPts >= 0 ? `+${stats.netPts}` : stats.netPts} color={stats.netPts < 0 ? '#e53935' : undefined} />
          <StatCell label="Totale pasti" value={stats.lifetimeTotal} />
          {stats.trackingCoveragePct != null && (
            <StatCell label="% Tracciato" value={`${stats.trackingCoveragePct}%`} color={stats.trackingCoveragePct >= 90 ? '#4caf50' : (stats.trackingCoveragePct >= 70 ? undefined : '#e53935')} />
          )}
          {stats.untrackedCount7d > 0 && <StatCell label="Non tracciati 7gg" value={stats.untrackedCount7d} color="#e53935" />}
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
                  if (e.untracked) {
                    return (
                      <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.18)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1em' }}>⚠️</span>
                          <span style={{ fontSize: '0.75em', color: 'var(--text-sec)', flex: 1 }}>
                            {e.date === today ? 'Oggi' : fmtDate(e.date)} · {fmtTime(e.time)} · {e.count} non tracciat{e.count === 1 ? 'o' : 'i'}
                          </span>
                          <span style={{ fontSize: '0.72em', color: '#e53935', fontWeight: 700 }}>{e.pts}pt</span>
                          <button
                            className="btn-icon"
                            style={{ padding: 2 }}
                            onClick={() => { const { date, ...original } = e; actions.deleteMealEntry(date, original) }}
                          >
                            <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>delete</span>
                          </button>
                        </div>
                        {e.reason && <div style={{ fontSize: '0.68em', color: '#888', fontStyle: 'italic', paddingLeft: 24 }}>"{e.reason}"</div>}
                      </div>
                    )
                  }
                  const lvl = MEAL_LEVELS.find(l => l.level === e.level) || MEAL_LEVELS[1]
                  const hitTarget = e.target && e.durationMin >= e.target
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                      <span style={{ fontSize: '1em' }}>{lvl.emoji}</span>
                      <span style={{ fontSize: '0.75em', color: 'var(--text-sec)', flex: 1 }}>
                        {e.date === today ? 'Oggi' : fmtDate(e.date)} · {fmtTime(e.time)}
                      </span>
                      {hitTarget && <span style={{ fontSize: '0.85em' }} title={`Obiettivo ${e.target}m centrato`}>🎯</span>}
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
