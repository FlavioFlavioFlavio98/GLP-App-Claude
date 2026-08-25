import { useState } from 'react'
import { useApp } from '../lib/store'
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

const inputStyle = {
  flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.8em', boxSizing: 'border-box',
}

function RecapEditor({ categories: initial, onSave, onCancel }) {
  const [categories, setCategories] = useState(() => initial.map(c => ({ ...c, items: [...c.items] })))

  function updateCat(ci, field, value) {
    setCategories(cs => cs.map((c, i) => i === ci ? { ...c, [field]: value } : c))
  }
  function updateItem(ci, ii, value) {
    setCategories(cs => cs.map((c, i) => i === ci ? { ...c, items: c.items.map((it, j) => j === ii ? value : it) } : c))
  }
  function deleteItem(ci, ii) {
    setCategories(cs => cs.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c))
  }
  function addItem(ci) {
    setCategories(cs => cs.map((c, i) => i === ci ? { ...c, items: [...c.items, ''] } : c))
  }
  function deleteCategory(ci) {
    setCategories(cs => cs.filter((_, i) => i !== ci))
  }
  function addCategory() {
    setCategories(cs => [...cs, { key: `custom-${Date.now()}`, label: 'Nuova categoria', emoji: '✨', items: [''] }])
  }
  function handleSave() {
    const cleaned = categories
      .map(c => ({ ...c, items: c.items.map(i => i.trim()).filter(Boolean) }))
      .filter(c => c.items.length > 0)
    onSave(cleaned)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {categories.map((cat, ci) => (
        <div key={cat.key} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <input value={cat.emoji} onChange={e => updateCat(ci, 'emoji', e.target.value)} style={{ ...inputStyle, flex: '0 0 40px', textAlign: 'center' }} />
            <input value={cat.label} onChange={e => updateCat(ci, 'label', e.target.value)} style={{ ...inputStyle, fontWeight: 700, color: 'var(--theme-color)' }} />
            <button className="btn-icon" style={{ padding: 4, flexShrink: 0 }} onClick={() => deleteCategory(ci)}>
              <span className="material-icons-round" style={{ fontSize: 16, color: '#444' }}>delete</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cat.items.map((item, ii) => (
              <div key={ii} style={{ display: 'flex', gap: 6 }}>
                <input value={item} onChange={e => updateItem(ci, ii, e.target.value)} style={inputStyle} />
                <button className="btn-icon" style={{ padding: 4, flexShrink: 0 }} onClick={() => deleteItem(ci, ii)}>
                  <span className="material-icons-round" style={{ fontSize: 14, color: '#444' }}>close</span>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => addItem(ci)}
            style={{ marginTop: 6, background: 'transparent', border: 'none', color: 'var(--theme-color)', fontSize: '0.72em', cursor: 'pointer', padding: 0 }}
          >
            + voce
          </button>
        </div>
      ))}

      <button
        onClick={addCategory}
        style={{
          padding: '10px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
          color: 'var(--text)', fontSize: '0.8em', fontWeight: 600,
        }}
      >
        + Nuova categoria
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-main" style={{ flex: 1, padding: '11px', margin: 0 }} onClick={handleSave}>Salva</button>
        <button className="btn-sec" style={{ flex: 1, padding: '11px', margin: 0 }} onClick={onCancel}>Annulla</button>
      </div>
    </div>
  )
}

export default function DayRecapSection({ dayRecapLog, actions }) {
  const { state } = useApp()
  const todayStr = toDateString(new Date())
  const viewDate = state.viewDate || todayStr
  const isToday = viewDate === todayStr

  const [transcript, setTranscript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [expandedDate, setExpandedDate] = useState(null)

  const viewEntry = dayRecapLog?.[viewDate]
  const streak = computeDayRecapStreak(dayRecapLog)
  const pastDates = Object.keys(dayRecapLog || {}).filter(d => d !== viewDate).sort().reverse().slice(0, 14)

  async function handleGenerate() {
    if (!transcript.trim()) { actions.showToast('Incolla prima la trascrizione', '⚠️'); return }
    setGenerating(true)
    try {
      await actions.generateDayRecap(transcript, viewDate)
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
          📝 Riepilogo {isToday ? 'Giornata' : `del ${fmtDate(viewDate)}`}
        </div>
        <ActivityRateEditor getRate={getDayRecapRate} setRate={setDayRecapRate} unit="pt" label="Punti Riepilogo" />
      </div>

      {streak.current > 0 && (
        <div style={{ fontSize: '0.72em', color: '#888', marginBottom: 10 }}>
          🔥 {streak.current} giorni di fila · record {streak.best}
        </div>
      )}

      {viewEntry ? (
        editing ? (
          <RecapEditor
            categories={viewEntry.categories || []}
            onSave={async cats => { await actions.updateDayRecap(viewDate, cats); setEditing(false) }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <RecapCard entry={viewEntry} />
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--theme-color)', fontSize: '0.72em', padding: 0,
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>
                Modifica
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(`Eliminare il riepilogo ${isToday ? 'di oggi' : `del ${fmtDate(viewDate)}`}?`)) return
                  await actions.deleteDayRecap(viewDate)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--danger, #e53935)', fontSize: '0.72em', padding: 0,
                }}
              >
                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>
                Elimina
              </button>
            </div>
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
        )
      ) : (
        <>
          <div style={{ fontSize: '0.78em', color: '#888', marginBottom: 10 }}>
            {isToday
              ? "Incolla la trascrizione della tua nota vocale di oggi — l'AI la organizza in un riepilogo a categorie, facile da rivedere prima di dormire."
              : `Nessun riepilogo per il ${fmtDate(viewDate)} — puoi generarne uno incollando una trascrizione riferita a quel giorno.`}
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
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Eliminare il riepilogo del ${fmtDate(d)}?`)) return
                        await actions.deleteDayRecap(d)
                        setExpandedDate(null)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--danger, #e53935)', fontSize: '0.72em', padding: 0,
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>
                      Elimina
                    </button>
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
