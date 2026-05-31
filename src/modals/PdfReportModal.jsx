import { useState } from 'react'
import { useApp } from '../lib/store'
import { generatePdfReport } from '../lib/pdfReport'

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export default function PdfReportModal() {
  const { state, actions } = useApp()
  const { modal, globalData, currentUser, theme } = state
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [loading, setLoading] = useState(false)

  if (modal !== 'pdfReport') return null

  async function handleExport() {
    setLoading(true)
    try {
      await generatePdfReport({ userData: globalData, currentUser, themeId: theme, year, month })
      actions.showToast('PDF scaricato!', '📄')
      actions.closeModal()
    } catch (e) {
      console.error(e)
      actions.showToast('Errore generazione PDF', '❌')
    } finally {
      setLoading(false)
    }
  }

  const years = [today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && actions.closeModal()}>
      <div className="modal-box" style={{ textAlign: 'center' }}>
        <h3>📄 Esporta Report PDF</h3>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 20 }}>
          Genera un report mensile completo per {currentUser === 'flavio' ? 'Flavio' : 'Simona'}
        </p>

        <div className="grid-2">
          <div className="input-group">
            <label>Mese</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Anno</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ margin: '16px 0', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: '0.8em', color: '#888', textAlign: 'left' }}>
          <strong style={{ color: 'var(--theme-color)' }}>Il PDF includerà:</strong>
          <div style={{ marginTop: 6, lineHeight: 1.8 }}>
            📊 Copertina · Riepilogo · Grafico giornaliero<br/>
            🏷️ Analisi categorie · Lista abitudini · Storico acquisti
          </div>
        </div>

        <button className="btn-main" onClick={handleExport} disabled={loading}>
          {loading ? '⏳ Generazione in corso...' : `📥 Scarica ${MONTHS[month]} ${year}`}
        </button>
        <button className="btn-sec" onClick={() => actions.closeModal()}>Annulla</button>
      </div>
    </div>
  )
}
