import { useState } from 'react'
import { toDateString } from '../lib/habitLogic'
import { getDayRecapRate, setDayRecapRate, computeDayRecapStreak } from '../lib/dayRecapStats'
import ActivityRateEditor from './ActivityRateEditor'

function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function RecapCard({ entry }) {
  if (!entry?.categories?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entry.categories.map(cat => (
        <div key={cat.key}>
          <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--theme-color)', marginBottom: 4 }}>
            {cat.emoji} {cat.label}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cat.items.map((item, i) => (
              <li key={i} style={{ fontSize: '0.82em', color: 'var(--text)', marginBottom: 2 }}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function DayRecapSection({ dayRecapLog, actions }) {
  const todayStr = toDateString(new Date())
  const [transcript, setTranscript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [expandedDate, setExpandedDate] = useState(null)

  const todayEntry = dayRecapLog?.[todayStr]
  const streak = computeDayRecapStreak(dayRecapLog)
  const pastDates = Object.keys(dayRecapLog || {}).filter(d => d !== todayStr).sort().reverse().slice(0, 14)

  async function handleGenerate() {
    if (!transcript.trim()) { actions.showToast('Incolla prima la trascrizione', '⚠️'); return }
    setGenerating(true)
    try {
      await actions.generateDayRecap(transcript, todayStr)
      setTranscript('')
    } catch (e) {
      actions.showToast('Errore generazione: ' + (e.message || ''), '❌')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          📝 Riepilogo Giornata
        </div>
        <ActivityRateEditor getRate={getDayRecapRate} setRate={setDayRecapRate} unit="pt" label="Punti Riepilogo" />
      </div>

      {streak.current > 0 && (
        <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 10 }}>
          🔥 {streak.current} giorni di fila · record {streak.best}
        </div>
      )}

      {todayEntry ? (
        <>
          <RecapCard entry={todayEntry} />
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: '0.72em', color: '#666', cursor: 'pointer' }}>Rigenera con nuovo testo</summary>
            <div style={{ marginTop: 8 }}>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Incolla qui la trascrizione della nota vocale..."
                rows={5}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85em', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
              />
              <button className="btn-main" style={{ width: '100%', padding: '12px' }} onClick={handleGenerate} disabled={generating}>
                {generating ? '⏳ Genero...' : 'Rigenera riepilogo'}
              </button>
            </div>
          </details>
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.78em', color: '#888', marginBottom: 10 }}>
            Incolla la trascrizione della tua nota vocale di oggi — l'AI la organizza in un riepilogo a categorie, facile da rivedere prima di dormire.
          </div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Incolla qui la trascrizione della nota vocale..."
            rows={6}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85em', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }}
          />
          <button className="btn-main" style={{ width: '100%', padding: '13px' }} onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳ Genero il riepilogo...' : '✨ Genera riepilogo'}
          </button>
        </>
      )}

      {pastDates.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.68em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
            Storico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pastDates.map(d => (
              <div key={d}>
                <button
                  onClick={() => setExpandedDate(expandedDate === d ? null : d)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontSize: '0.8em',
                  }}
                >
                  <span>{fmtDate(d)}</span>
                  <span style={{ color: '#666' }}>{dayRecapLog[d].categories?.length || 0} categorie</span>
                </button>
                {expandedDate === d && (
                  <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginTop: 4 }}>
                    <RecapCard entry={dayRecapLog[d]} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
