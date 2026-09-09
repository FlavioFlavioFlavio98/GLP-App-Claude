import { useState, useEffect, useRef } from 'react'

// Sessione (task + orario di inizio) persistita in localStorage — stesso
// motivo di MealsTab/LifeAreaTimerCard: cambiare tab o ricaricare la pagina
// non deve far perdere il cronometro in corso. Richiesta esplicita di
// Flavio: vuole capire quanto tempo passa su ogni task, con un promemoria
// (vibrazione, dove supportata) ogni 60s per ricordargli di fermarlo se ha
// cambiato task.
const SESSION_KEY = 'glp_task_timer_session'
const REMINDER_INTERVAL_MS = 60_000

export function readTaskTimerSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.start === 'number' && !isNaN(parsed.start) && parsed?.taskId) return parsed
  } catch { /* sessione corrotta, si riparte da capo */ }
  return null
}

function writeSession(taskId, taskTitle, start) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ taskId, taskTitle, start })) } catch { /* ignore */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

function fmtElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// taskId/taskTitle arrivano dal genitore (TaskTab), che possiede lo stato
// "quale task ha il timer attivo" — questo componente si occupa solo del
// cronometro stesso: persistenza, tick, vibrazione periodica, salvataggio.
export default function TaskTimerCard({ taskId, taskTitle, actions, onFinish, onCancel }) {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(null)
  const tickRef = useRef(null)
  const reminderRef = useRef(null)

  useEffect(() => {
    if (!taskId) return
    // Riprende una sessione già in corso (stesso taskId) invece di
    // riazzerare il cronometro, altrimenti un semplice remount (cambio tab
    // e ritorno) farebbe ripartire da 0 un timer che stava già scorrendo.
    const existing = readTaskTimerSession()
    const start = (existing?.taskId === taskId) ? existing.start : Date.now()
    startTimeRef.current = start
    writeSession(taskId, taskTitle, start)
    setElapsed(Math.floor((Date.now() - start) / 1000))

    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    reminderRef.current = setInterval(() => {
      navigator.vibrate?.([80])
      actions.showToast('⏱️ Sei ancora su questa task?', '⏱️')
    }, REMINDER_INTERVAL_MS)

    return () => {
      clearInterval(tickRef.current)
      clearInterval(reminderRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  if (!taskId) return null

  function finish() {
    clearInterval(tickRef.current)
    clearInterval(reminderRef.current)
    const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    clearSession()
    onFinish(finalElapsed)
  }

  function cancel() {
    clearInterval(tickRef.current)
    clearInterval(reminderRef.current)
    clearSession()
    onCancel()
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Timer in corso</div>
      <div style={{ fontSize: '1.2em', fontWeight: 700, textAlign: 'center', marginBottom: 20, maxWidth: 320 }}>{taskTitle}</div>
      <div style={{ fontSize: '3.2em', fontWeight: 900, color: 'var(--theme-color)', marginBottom: 30, fontVariantNumeric: 'tabular-nums' }}>
        {fmtElapsed(elapsed)}
      </div>
      <button className="btn-main" style={{ width: 220, padding: '14px', fontSize: '1.05em', marginBottom: 10 }} onClick={finish}>
        ⏹ Fine
      </button>
      <button className="btn-sec" style={{ width: 220 }} onClick={cancel}>
        Annulla
      </button>
    </div>
  )
}
