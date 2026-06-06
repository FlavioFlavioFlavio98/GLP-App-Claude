import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { CAT_LABELS } from '../lib/journalQuestions'

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export default function JournalViewModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser } = state
  if (modal !== 'journalView') return null

  // Journal entries only for the current user (privacy — globalData is always the current user's doc)
  const entries = globalData?.journalEntries || {}
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const sorted = useMemo(() => {
    return Object.keys(entries)
      .filter(d => entries[d].answer) // skip skipped entries
      .sort((a, b) => b.localeCompare(a))
      .filter(d => {
        if (monthFilter && !d.startsWith(monthFilter)) return false
        if (search && !entries[d].answer.toLowerCase().includes(search.toLowerCase()) &&
            !entries[d].question.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
  }, [entries, search, monthFilter])

  // Unique months available
  const months = useMemo(() => {
    const set = new Set(Object.keys(entries).filter(d => entries[d].answer).map(d => d.slice(0, 7)))
    return [...set].sort().reverse()
  }, [entries])

  function exportTxt() {
    const lines = sorted.map(d => {
      const e = entries[d]
      return `📅 ${d.split('-').reverse().join('/')}\n❓ ${e.question}\n💭 ${e.answer}\n${'─'.repeat(40)}`
    }).join('\n\n')
    const blob = new Blob([`IL MIO DIARIO GLP — ${currentUser}\n${'═'.repeat(40)}\n\n${lines}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `GLP_Diario_${currentUser}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.15em', color: 'var(--theme-color)', flex: 1 }}>
          📔 Il mio diario
        </h1>
        <button className="btn-icon" onClick={exportTxt} title="Esporta TXT">
          <span className="material-icons-round" style={{ fontSize: 20 }}>download</span>
        </button>
      </div>

      <div className="single-habit-body">
        {/* Search + month filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', minWidth: 160 }}>
            <span className="material-icons-round" style={{ fontSize: 16, color: '#555' }}>search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca nelle risposte..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.88em', flex: 1, padding: 0 }}
            />
          </div>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text)', padding: '6px 10px', fontSize: '0.85em' }}
          >
            <option value="">Tutti i mesi</option>
            {months.map(m => {
              const [yr, mo] = m.split('-')
              return <option key={m} value={m}>{MONTHS_IT[parseInt(mo) - 1]} {yr}</option>
            })}
          </select>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--theme-color)', fontSize: '1.4em' }}>{Object.keys(entries).filter(d => entries[d].answer).length}</div>
            <div style={{ fontSize: '0.65em', color: '#555' }}>Risposte totali</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.4em' }}>
              {(() => {
                const last30 = Array.from({length: 30}, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - i)
                  const y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), dy = String(d.getDate()).padStart(2,'0')
                  return `${y}-${mo}-${dy}`
                })
                return `${last30.filter(d => entries[d]?.answer).length}/30`
              })()}
            </div>
            <div style={{ fontSize: '0.65em', color: '#555' }}>Ultimi 30gg</div>
          </div>
        </div>

        {/* Entries list */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>
            {search || monthFilter ? 'Nessuna voce trovata' : 'Nessuna risposta ancora — apri il diario dalla home!'}
          </div>
        ) : sorted.map(dateStr => {
          const e = entries[dateStr]
          const [yr, mo, dd] = dateStr.split('-')
          return (
            <div key={dateStr} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: '0.72em', color: 'var(--theme-color)', fontWeight: 700 }}>
                  📅 {parseInt(dd)} {MONTHS_IT[parseInt(mo) - 1]} {yr}
                </div>
                {e.question && (
                  <div style={{ fontSize: '0.62em', color: '#444', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {CAT_LABELS[JOURNAL_QUESTIONS_CAT[e.questionId]] || ''}
                  </div>
                )}
              </div>
              {e.question && (
                <div style={{ fontSize: '0.78em', color: '#666', marginBottom: 6, fontStyle: 'italic' }}>
                  {e.question}
                </div>
              )}
              <div style={{ fontSize: '0.88em', color: 'var(--text-sec)', lineHeight: 1.6 }}>
                {e.answer}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Quick lookup: questionId → cat (built from the questions list)
import { JOURNAL_QUESTIONS } from '../lib/journalQuestions'
const JOURNAL_QUESTIONS_CAT = {}
JOURNAL_QUESTIONS.forEach(q => { JOURNAL_QUESTIONS_CAT[q.id] = q.cat })
