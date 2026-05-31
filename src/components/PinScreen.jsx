import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'glp_unlocked'
const ATTEMPTS_KEY = 'glp_pin_attempts'
const LOCKED_UNTIL_KEY = 'glp_pin_locked_until'
const MAX_ATTEMPTS = 5
const LOCK_SECONDS = 30
const SESSION_HOURS = 24

export function isSessionValid() {
  const ts = localStorage.getItem(SESSION_KEY)
  if (!ts) return false
  return Date.now() - parseInt(ts) < SESSION_HOURS * 60 * 60 * 1000
}

export function unlockSession() {
  localStorage.setItem(SESSION_KEY, String(Date.now()))
}

const NUMPAD = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['','0','⌫'],
]

export default function PinScreen({ correctPin, onUnlock }) {
  const [digits, setDigits] = useState([])
  const [error, setError] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockSecs, setLockSecs] = useState(0)
  const [attempts, setAttempts] = useState(() => parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0'))
  const intervalRef = useRef(null)
  const shakeTimer = useRef(null)

  // Check if already locked on mount
  useEffect(() => {
    const until = parseInt(localStorage.getItem(LOCKED_UNTIL_KEY) || '0')
    if (Date.now() < until) startCountdown(until)
    return () => { clearInterval(intervalRef.current); clearTimeout(shakeTimer.current) }
  }, [])

  // Auto-check when 4 digits entered
  useEffect(() => {
    if (digits.length === 4) {
      const entered = digits.join('')
      if (entered === correctPin) {
        localStorage.removeItem(ATTEMPTS_KEY)
        localStorage.removeItem(LOCKED_UNTIL_KEY)
        unlockSession()
        onUnlock()
      } else {
        triggerError()
      }
    }
  }, [digits])

  function startCountdown(until) {
    setLocked(true)
    clearInterval(intervalRef.current)
    const tick = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000)
      if (remaining <= 0) {
        clearInterval(intervalRef.current)
        setLocked(false)
        setLockSecs(0)
        setAttempts(0)
        localStorage.removeItem(ATTEMPTS_KEY)
        localStorage.removeItem(LOCKED_UNTIL_KEY)
      } else {
        setLockSecs(remaining)
      }
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
  }

  function triggerError() {
    if (navigator.vibrate) navigator.vibrate([80, 40, 80])
    const next = attempts + 1
    setAttempts(next)
    localStorage.setItem(ATTEMPTS_KEY, String(next))
    setError(true)
    clearTimeout(shakeTimer.current)
    shakeTimer.current = setTimeout(() => {
      setError(false)
      setDigits([])
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_SECONDS * 1000
        localStorage.setItem(LOCKED_UNTIL_KEY, String(until))
        startCountdown(until)
      }
    }, 500)
  }

  function handleKey(key) {
    if (locked || digits.length === 4) return
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1))
    } else if (key && digits.length < 4) {
      setDigits(d => [...d, key])
    }
  }

  // Also allow hardware keyboard
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleKey('⌫')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [digits, locked])

  const remainingAttempts = MAX_ATTEMPTS - attempts

  return (
    <div className="pin-screen">
      <div className="pin-top">
        <div className="pin-logo">🔥</div>
        <div className="pin-app-name">GLP</div>
        <div className="pin-subtitle">Gamification Life Project</div>
      </div>

      <div className="pin-middle">
        <div className="pin-title">
          {locked ? `🔒 Bloccato` : 'Inserisci PIN'}
        </div>

        {/* 4 dots */}
        <div className={`pin-dots${error ? ' pin-dots-error' : ''}`}>
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`pin-dot${digits.length > i ? (error ? ' filled error' : ' filled') : ''}`}
            />
          ))}
        </div>

        {locked ? (
          <div className="pin-locked-msg">
            <div className="pin-locked-timer">{lockSecs}s</div>
            <div className="pin-locked-sub">Riprova tra {lockSecs} secondi</div>
          </div>
        ) : (
          attempts > 0 && (
            <div className="pin-attempts-warn">
              {remainingAttempts > 0
                ? `Tentativi rimasti: ${remainingAttempts}`
                : 'Troppi tentativi!'}
            </div>
          )
        )}
      </div>

      {/* Numpad */}
      <div className="pin-numpad" style={{ opacity: locked ? 0.3 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
        {NUMPAD.map((row, ri) => (
          <div className="pin-row" key={ri}>
            {row.map((key, ki) => (
              key === '' ? (
                <div key={ki} className="pin-key pin-key-empty" />
              ) : (
                <button
                  key={ki}
                  className={`pin-key${key === '⌫' ? ' pin-key-back' : ''}`}
                  onClick={() => handleKey(key)}
                  onTouchStart={e => e.currentTarget.classList.add('pressed')}
                  onTouchEnd={e => e.currentTarget.classList.remove('pressed')}
                >
                  {key === '⌫'
                    ? <span className="material-icons-round">backspace</span>
                    : key}
                </button>
              )
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
