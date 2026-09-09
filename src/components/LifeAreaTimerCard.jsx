import { useState, useEffect, useRef } from 'react'
import { computeLifeAreaPoints } from '../lib/lifeAreaStats'

// La sessione (orario di inizio + area) vive in localStorage, non solo nello
// stato del componente — stesso motivo di MealsTab.jsx: cambiare tab smonta
// il componente, mettere il browser in background o chiudere l'app non deve
// azzerare il timer. L'unico modo per fermarla resta il tasto "Fine sessione".
const SESSION_KEY = 'glp_lifearea_session'

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.start === 'number' && !isNaN(parsed.start) && parsed?.areaId) return parsed
  } catch { /* sessione corrotta, si riparte da capo */ }
  return null
}

function fmtElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function LifeAreaTimerCard({ areas, actions }) {
  const [sessionActive, setSessionActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pickerAreaId, setPickerAreaId] = useState(areas[0]?.id || null)
  const [confirming, setConfirming] = useState(false)
  const [pendingDuration, setPendingDuration] = useState(0)
  const [pendingNote, setPendingNote] = useState('')
  const [pendingAreaId, setPendingAreaId] = useState(null)
  const [saving, setSaving] = useState(false)

  const tickRef = useRef(null)
  const wakeLockRef = useRef(null)
  const startTimeRef = useRef(null)
  const sessionAreaIdRef = useRef(null)

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

  // Ricalcola sempre l'elapsed dall'orario di inizio reale invece di
  // incrementare un contatore — un tab in background può ritardare i tick,
  // ma al prossimo tick utile il valore si autocorregge comunque, stesso
  // principio di MealsTab.jsx.
  function startTicking() {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  useEffect(() => {
    const stored = readSession()
    if (stored) {
      startTimeRef.current = stored.start
      sessionAreaIdRef.current = stored.areaId
      setElapsed(Math.floor((Date.now() - stored.start) / 1000))
      setSessionActive(true)
      acquireWakeLock()
      startTicking()
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      releaseWakeLock()
    }
  }, [])

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

  function startSession() {
    if (!pickerAreaId) return
    const start = Date.now()
    startTimeRef.current = start
    sessionAreaIdRef.current = pickerAreaId
    localStorage.setItem(SESSION_KEY, JSON.stringify({ start, areaId: pickerAreaId }))
    setElapsed(0)
    setSessionActive(true)
    acquireWakeLock()
    startTicking()
  }

  function endSession() {
    if (tickRef.current) clearInterval(tickRef.current)
    releaseWakeLock()
    localStorage.removeItem(SESSION_KEY)
    const finalElapsed = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : elapsed
    setSessionActive(false)
    setPendingDuration(Math.max(1, Math.round(finalElapsed / 60)))
    setPendingAreaId(sessionAreaIdRef.current)
    setPendingNote('')
    setConfirming(true)
  }

  async function confirmSave() {
    setSaving(true)
    await actions.addLifeAreaSession(pendingAreaId, pendingDuration, pendingNote, null, 'timer')
    setSaving(false)
    setConfirming(false)
    setElapsed(0)
  }

  const activeAreas = areas.filter(a => a.active !== false)
  if (activeAreas.length === 0) return null

  const sessionArea = activeAreas.find(a => a.id === sessionAreaIdRef.current)

  if (confirming) {
    const pendingArea = activeAreas.find(a => a.id === pendingAreaId)
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.75em', color: '#888', marginBottom: 10 }}>Sessione conclusa — conferma prima di salvare</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={() => setPendingDuration(d => Math.max(1, d - 1))} style={smallBtnStyle}>−</button>
          <div style={{ fontSize: '2em', fontWeight: 900, color: 'var(--theme-color)', minWidth: 70, textAlign: 'center' }}>{pendingDuration}m</div>
          <button onClick={() => setPendingDuration(d => d + 1)} style={smallBtnStyle}>+</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 10, fontSize: '1.05em', fontWeight: 700, color: 'var(--success)' }}>
          {pendingArea?.emoji} = +{computeLifeAreaPoints(pendingDuration)} pt
        </div>
        <textarea
          value={pendingNote}
          onChange={e => setPendingNote(e.target.value)}
          placeholder="Nota (opzionale)"
          maxLength={200}
          rows={2}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85em', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', marginBottom: 10 }}
        />
        <button className="btn-main" style={{ width: '100%', padding: '12px' }} onClick={confirmSave} disabled={saving}>
          {saving ? '⏳ Salvataggio...' : 'Salva sessione'}
        </button>
      </div>
    )
  }

  if (sessionActive) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', fontSize: '0.85em', color: '#888', marginBottom: 6 }}>{sessionArea?.emoji} {sessionArea?.name}</div>
        <div style={{ textAlign: 'center', fontSize: '2.6em', fontWeight: 900, color: 'var(--theme-color)', lineHeight: 1, marginBottom: 12 }}>
          {fmtElapsed(elapsed)}
        </div>
        <button className="btn-main" style={{ width: '100%', padding: '12px' }} onClick={endSession}>Fine sessione</button>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Timer dal vivo</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {activeAreas.map(a => {
          const active = pickerAreaId === a.id
          return (
            <button
              key={a.id}
              onClick={() => setPickerAreaId(a.id)}
              style={{
                padding: '8px 14px', borderRadius: 20,
                border: active ? `1px solid ${a.color || 'var(--theme-color)'}` : '1px solid var(--card-border)',
                background: active ? `${a.color || 'var(--theme-color)'}22` : 'var(--surface)',
                color: active ? (a.color || 'var(--theme-color)') : 'var(--text)',
                fontSize: '0.85em', fontWeight: active ? 700 : 500, cursor: 'pointer',
              }}
            >
              {a.emoji} {a.name}
            </button>
          )
        })}
      </div>
      <button className="btn-main" style={{ width: '100%', padding: '12px', opacity: pickerAreaId ? 1 : 0.5 }} onClick={startSession} disabled={!pickerAreaId}>
        ▶️ Inizia timer
      </button>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--card-border)',
  borderRadius: 14, padding: 16, marginBottom: 16,
}

const smallBtnStyle = {
  width: 40, height: 40, borderRadius: '50%',
  border: '1px solid var(--card-border)', background: 'var(--card-border)',
  color: 'var(--text)', fontSize: '1.2em', fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
