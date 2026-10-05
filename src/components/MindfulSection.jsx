import { toDateString } from '../lib/habitLogic'
import { mindfulGoal, mindfulTimes, mindfulHistory, mindfulStreak } from '../lib/mindful'

// Momenti di consapevolezza: conteggio di oggi sull'obiettivo (es. 1/3), un
// pulsante grande per aggiungerne uno, gli orari di oggi (tocco sulla × per
// togliere un tocco sbagliato) e gli ultimi 7 giorni. Stessi dati scritti dal
// Pixel Watch (complicazione/Tile "Consapevolezza"), che resta il modo
// principale per registrarli.

const DAY_INITIALS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

export default function MindfulSection({ globalData, actions }) {
  const today = toDateString(new Date())
  const goal = mindfulGoal(globalData)
  const times = mindfulTimes(globalData, today)
  const count = times.length
  const reached = count >= goal
  const history = mindfulHistory(globalData, today, 7)
  const streak = mindfulStreak(globalData, today)

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          🧘 Momenti di consapevolezza
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72em', color: '#888' }}>
          <span>Obiettivo</span>
          <button onClick={() => actions.setMindfulGoal(goal - 1)} disabled={goal <= 1} aria-label="Riduci obiettivo"
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', cursor: goal <= 1 ? 'default' : 'pointer', opacity: goal <= 1 ? 0.4 : 1 }}>−</button>
          <strong style={{ color: 'var(--text)', minWidth: 14, textAlign: 'center' }}>{goal}</strong>
          <button onClick={() => actions.setMindfulGoal(goal + 1)} aria-label="Aumenta obiettivo"
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ textAlign: 'center', minWidth: 78 }}>
          <div style={{ fontSize: '2.1em', fontWeight: 800, lineHeight: 1, color: reached ? 'var(--success)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {count}/{goal}
          </div>
          <div style={{ fontSize: '0.66em', color: '#888', marginTop: 4 }}>{reached ? 'obiettivo raggiunto 🎉' : 'oggi'}</div>
        </div>
        <button
          onClick={() => actions.addMindfulMoment()}
          style={{
            flex: 1, padding: '14px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--theme-color)', color: '#000', fontSize: '0.92em', fontWeight: 800,
          }}
        >+ Momento di consapevolezza</button>
      </div>

      {times.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {times.map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 9px', borderRadius: 12, fontSize: '0.74em', background: 'var(--surface)', border: '1px solid var(--card-border)', color: '#aaa' }}>
              {t.slice(0, 5)}
              <button onClick={() => actions.removeMindfulMoment(today, t)} aria-label={`Rimuovi momento delle ${t.slice(0, 5)}`}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.1em', lineHeight: 1, padding: '0 4px' }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {history.map(d => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72em', fontWeight: 700,
              background: d.reached ? 'var(--success)' : d.count > 0 ? 'rgba(76,175,80,0.22)' : 'var(--surface)',
              color: d.reached ? '#000' : d.count > 0 ? 'var(--text)' : '#555',
              border: d.date === today ? '1px solid var(--theme-color)' : '1px solid transparent',
            }}>{d.count}</div>
            <div style={{ fontSize: '0.58em', color: '#666', marginTop: 3 }}>{DAY_INITIALS[new Date(d.date + 'T12:00:00').getDay()]}</div>
          </div>
        ))}
        <div style={{ minWidth: 54, textAlign: 'right', paddingBottom: 12 }}>
          <div style={{ fontSize: '0.95em', fontWeight: 800, color: streak > 0 ? 'var(--success)' : '#666' }}>{streak}gg</div>
          <div style={{ fontSize: '0.56em', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>serie</div>
        </div>
      </div>
    </div>
  )
}
