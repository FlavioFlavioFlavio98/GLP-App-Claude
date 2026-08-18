import { SUN_LEVELS, getSunExposureForDate, countSunExposureDays } from '../lib/bodyStats'
import { toDateString } from '../lib/habitLogic'

const TIMES = [
  { key: 'morning', label: 'Mattina', emoji: '🌅' },
  { key: 'evening', label: 'Sera', emoji: '🌇' },
]

// Solo tracciamento, nessun punteggio — un valore per giorno per mattina/sera,
// si sovrascrive (tap di nuovo sullo stesso livello per azzerarlo).
export default function SunExposureSection({ sunExposureLog, actions }) {
  const todayStr = toDateString(new Date())
  const today = getSunExposureForDate(sunExposureLog, todayStr)
  const daysThisWeek = countSunExposureDays(sunExposureLog, 7)

  function pick(timeOfDay, level) {
    const isSame = today[timeOfDay] === level
    actions.setSunExposure(todayStr, timeOfDay, isSame ? null : level)
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
        ☀️ Sun Exposure — oggi
      </div>

      {TIMES.map(t => (
        <div key={t.key} style={{ marginBottom: t.key === 'morning' ? 12 : 10 }}>
          <div style={{ fontSize: '0.72em', color: '#888', fontWeight: 600, marginBottom: 6 }}>{t.emoji} {t.label}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SUN_LEVELS.map(lvl => {
              const active = today[t.key] === lvl.value
              return (
                <button
                  key={lvl.value}
                  onClick={() => pick(t.key, lvl.value)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    background: active ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? 'var(--theme-color)' : 'var(--text)',
                  }}
                >
                  <div style={{ fontSize: '1.1em' }}>{lvl.emoji}</div>
                  <div style={{ fontSize: '0.65em', fontWeight: 700, marginTop: 2 }}>{lvl.label}</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ fontSize: '0.65em', color: '#666', textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {daysThisWeek}/7 giorni tracciati questa settimana
      </div>
    </div>
  )
}
