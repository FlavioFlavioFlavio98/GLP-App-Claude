import { useEffect, useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import {
  addDays, mondayOf, weekLabel, shortDayLabel,
  weekSummary, intentionFor, balanceGrid,
} from '../lib/lifeAreaWeek'

// Revisione settimanale della tab Aree:
// - mappa di equilibrio (ultime 4 settimane, un quadratino per giorno),
// - per ogni area: intenzione della settimana + cosa è stato fatto giorno per giorno,
// - nella settimana in corso: intenzioni per la settimana successiva.

const GRID_WEEKS = 4

// Campo intenzione: si salva all'uscita dal campo o con Invio, solo se cambiato.
function IntentionField({ weekKey, area, value, actions, placeholder, isReadOnly, showIcon = true }) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value, weekKey])

  function commit() {
    if (text.trim() !== value) actions.setLifeAreaIntention(weekKey, area.id, text)
  }

  if (isReadOnly) {
    return value ? <div style={{ fontSize: '0.8em', color: area.color || 'var(--theme-color)' }}>🎯 {value}</div> : null
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {showIcon && <span style={{ fontSize: '0.85em' }}>🎯</span>}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder={placeholder}
        maxLength={300}
        enterKeyHint="done"
        style={{
          flex: 1, minWidth: 0, padding: '6px 8px', fontSize: '0.82em',
          background: 'transparent', color: area.color || 'var(--theme-color)',
          border: 'none', borderBottom: '1px dashed var(--card-border)', outline: 'none',
        }}
      />
    </div>
  )
}

function BalanceMap({ rows }) {
  return (
    <div style={{ padding: '12px 14px', marginBottom: 14, background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
      <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Equilibrio · ultime {GRID_WEEKS} settimane
      </div>
      {rows.map(({ area, cells, activeDays, pastDays }) => (
        <div key={area.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 20, textAlign: 'center', fontSize: '0.95em' }} title={area.name}>{area.emoji}</span>
          <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
            {Array.from({ length: GRID_WEEKS }, (_, w) => (
              <div key={w} style={{ flex: 1, display: 'flex', gap: 2 }}>
                {cells.slice(w * 7, w * 7 + 7).map(c => (
                  <div
                    key={c.date}
                    title={`${shortDayLabel(c.date)}: ${c.count} ${c.count === 1 ? 'voce' : 'voci'}`}
                    style={{
                      flex: 1, aspectRatio: '1', borderRadius: 2, minWidth: 0,
                      background: c.count > 0 ? (area.color || 'var(--theme-color)') : 'var(--surface-2, rgba(255,255,255,0.06))',
                      opacity: c.future ? 0.25 : c.count === 0 ? 1 : c.count === 1 ? 0.55 : c.count === 2 ? 0.8 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <span style={{ width: 38, textAlign: 'right', fontSize: '0.68em', color: activeDays ? '#aaa' : '#f2994a', fontVariantNumeric: 'tabular-nums' }}>
            {activeDays}/{pastDays}
          </span>
        </div>
      ))}
      <div style={{ fontSize: '0.64em', color: '#666', marginTop: 4 }}>Ogni quadratino è un giorno (lun → dom). Numero = giorni con almeno una voce.</div>
    </div>
  )
}

export default function LifeAreaWeekView({ globalData, areas, actions, isReadOnly, onOpenDay }) {
  const today = toDateString(new Date())
  const currentMonday = mondayOf(today)
  const [monday, setMonday] = useState(currentMonday)
  const isCurrentWeek = monday === currentMonday
  const nextMonday = addDays(currentMonday, 7)

  const summary = weekSummary(globalData, areas, monday)
  const grid = balanceGrid(globalData, areas, monday, today, GRID_WEEKS)
  const totalEntries = summary.reduce((n, s) => n + s.total, 0)
  const emptyAreas = summary.filter(s => s.total === 0)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.78em', color: '#888' }}>
          {totalEntries} {totalEntries === 1 ? 'voce' : 'voci'}{emptyAreas.length ? ` · ${emptyAreas.length} ${emptyAreas.length === 1 ? 'area vuota' : 'aree vuote'}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => setMonday(m => addDays(m, -7))} aria-label="Settimana precedente"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}>
            <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_left</span>
          </button>
          <button onClick={() => setMonday(currentMonday)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 700, fontSize: '0.86em', minWidth: 96, textAlign: 'center' }}>
            {isCurrentWeek ? 'Questa settimana' : weekLabel(monday)}
          </button>
          <button onClick={() => setMonday(m => addDays(m, 7))} disabled={isCurrentWeek} aria-label="Settimana successiva"
            style={{ background: 'none', border: 'none', cursor: isCurrentWeek ? 'default' : 'pointer', color: isCurrentWeek ? '#444' : 'var(--text)', padding: 4 }}>
            <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_right</span>
          </button>
        </div>
      </div>
      {isCurrentWeek && <div style={{ fontSize: '0.72em', color: '#666', margin: '-8px 0 12px', textAlign: 'right' }}>{weekLabel(monday)}</div>}

      <BalanceMap rows={grid} />

      {summary.map(({ area, byDay, total, daysActive }) => (
        <div key={area.id} style={{
          padding: '12px 14px', marginBottom: 10,
          background: 'var(--surface)', border: '1px solid var(--card-border)',
          borderLeft: `4px solid ${area.color || 'var(--theme-color)'}`, borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1.3em' }}>{area.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: '0.95em', flex: 1 }}>{area.name}</span>
            <span style={{ fontSize: '0.72em', color: total ? '#aaa' : '#f2994a' }}>
              {total ? `${total} ${total === 1 ? 'voce' : 'voci'} · ${daysActive} ${daysActive === 1 ? 'giorno' : 'giorni'}` : 'nessuna voce'}
            </span>
          </div>

          <IntentionField
            weekKey={monday}
            area={area}
            value={intentionFor(globalData, monday, area.id)}
            actions={actions}
            isReadOnly={isReadOnly}
            placeholder="Intenzione per questa settimana (facoltativa)"
          />

          {byDay.map(d => (
            <div key={d.date} style={{ marginTop: 8 }}>
              <button
                onClick={() => onOpenDay(d.date)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.72em', fontWeight: 700, color: '#888', textTransform: 'capitalize' }}
              >{shortDayLabel(d.date)} ›</button>
              {d.items.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: '0.86em', lineHeight: 1.5, paddingLeft: 2 }}>
                  <span style={{ color: '#666' }}>{e.kind === 'session' ? '⏱' : '•'}</span>
                  <span style={{ flex: 1, wordBreak: 'break-word', color: e.kind === 'session' ? '#999' : 'var(--text)' }}>
                    {e.kind === 'session' ? `${e.text ? e.text + ' · ' : ''}${e.duration} min` : e.text}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {isCurrentWeek && !isReadOnly && areas.length > 0 && (
        <div style={{ padding: '12px 14px', marginTop: 6, background: 'var(--surface)', border: '1px dashed var(--theme-color)', borderRadius: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: 2 }}>🎯 Intenzioni per la prossima settimana</div>
          <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 10 }}>{weekLabel(nextMonday)} · una frase per area, la vedrai sulla card ogni giorno</div>
          {areas.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 22, textAlign: 'center' }}>{a.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <IntentionField
                  weekKey={nextMonday}
                  area={a}
                  value={intentionFor(globalData, nextMonday, a.id)}
                  actions={actions}
                  isReadOnly={isReadOnly}
                  placeholder={a.name}
                  showIcon={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
