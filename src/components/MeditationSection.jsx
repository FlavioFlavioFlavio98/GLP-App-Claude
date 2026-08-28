import { useState, useEffect } from 'react'
import { computeMeditationWeekStats, getMeditationRate, setMeditationRate } from '../lib/meditationStats'
import { toDateString } from '../lib/habitLogic'
import ActivityRateEditor from './ActivityRateEditor'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function StatCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || 'var(--theme-color)' }}>{value}</div>
      <div style={{ fontSize: '0.56em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function NoteBox({ dateStr, initialText, label, actions, autoFocus }) {
  const [text, setText] = useState(initialText || '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setText(initialText || ''); setDirty(false) }, [initialText, dateStr])

  function save() {
    if (!dirty) return
    actions.saveMeditationNote(dateStr, text)
    setDirty(false)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.68em', color: '#888', marginBottom: 4 }}>{label}</div>
      <textarea
        value={text}
        autoFocus={autoFocus}
        onChange={e => { setText(e.target.value); setDirty(true) }}
        onBlur={save}
        placeholder="Come ti sei sentito? Cosa hai notato?"
        style={{
          width: '100%', boxSizing: 'border-box', minHeight: 56, resize: 'vertical',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '9px 11px', color: 'var(--text)', fontSize: '0.85em',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
      {dirty && (
        <button
          onClick={save}
          style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--theme-color)', color: '#000', fontSize: '0.75em', fontWeight: 800, cursor: 'pointer' }}
        >
          Salva nota
        </button>
      )}
    </div>
  )
}

export default function MeditationSection({ meditationLog, meditationNotes, actions }) {
  const [showPastNotes, setShowPastNotes] = useState(false)
  const stats = computeMeditationWeekStats(meditationLog)
  const today = toDateString(new Date())

  const pastNotes = Object.entries(meditationNotes || {})
    .filter(([date, text]) => date !== today && (text || '').trim())
    .sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          🧘 Meditazione
        </div>
        <ActivityRateEditor getRate={getMeditationRate} setRate={setMeditationRate} unit="pt" label="Punti per momento" />
      </div>

      <button
        onClick={() => actions.logMeditation()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 14px', marginBottom: 12,
          background: 'var(--theme-color)', border: 'none',
          borderRadius: 12, cursor: 'pointer', color: '#000',
          fontSize: '0.92em', fontWeight: 800,
        }}
      >
        <span className="material-icons-round" style={{ fontSize: 21 }}>self_improvement</span>
        Ho meditato un momento
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
        <StatCell label="Ultimi 7gg" value={stats.total} />
        <StatCell label="Streak" value={`${stats.streak}g`} color={stats.streak > 0 ? 'var(--success, #4caf50)' : undefined} />
        <StatCell label="Totale" value={stats.lifetimeTotal} />
      </div>

      <NoteBox
        dateStr={today}
        initialText={(meditationNotes || {})[today]}
        label="Nota di oggi — come ti senti dopo?"
        actions={actions}
      />

      {pastNotes.length > 0 && (
        <>
          <button
            onClick={() => setShowPastNotes(v => !v)}
            style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              color: 'var(--text-sec)', fontSize: '0.72em', fontWeight: 700, cursor: 'pointer',
              padding: '6px 2px', textTransform: 'uppercase', letterSpacing: 0.4,
            }}
          >
            {showPastNotes ? '▾' : '▸'} Note precedenti ({pastNotes.length})
          </button>
          {showPastNotes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {pastNotes.map(([date, text]) => (
                <div key={date} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62em', color: '#666', marginBottom: 3 }}>{fmtDate(date)}</div>
                  <div style={{ fontSize: '0.8em', color: 'var(--text-sec)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{text}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
