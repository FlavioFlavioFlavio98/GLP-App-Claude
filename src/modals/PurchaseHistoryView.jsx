import { useState } from 'react'
import { useApp } from '../lib/store'
import { getAllPurchases } from '../lib/statsLogic'
import { toDateString } from '../lib/habitLogic'

const PERIODS = [
  { id: '7',   label: 'Settimana' },
  { id: '30',  label: 'Mese' },
  { id: '90',  label: '3 Mesi' },
  { id: 'all', label: 'Tutto' },
]

export default function PurchaseHistoryView() {
  const { state, actions } = useApp()
  const { modal, allUsersData } = state
  const [period, setPeriod] = useState('30')
  const [expanded, setExpanded] = useState(null)

  if (modal !== 'purchaseHistory') return null

  // Gather purchases
  let all = getAllPurchases(allUsersData.flavio).sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.time - a.time)

  // Filter by period
  if (period !== 'all') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(period))
    const cutoffStr = toDateString(cutoff)
    all = all.filter(p => p.dateStr >= cutoffStr)
  }

  const totalSpent = all.reduce((acc, p) => acc + p.cost, 0)

  return (
    <div className="single-habit-view">
      <div className="single-habit-topbar">
        <button className="btn-icon" onClick={() => actions.closeModal()}>
          <span className="material-icons-round" style={{ fontSize: 28 }}>arrow_back</span>
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1em', color: 'var(--theme-color)' }}>Storico Acquisti</h1>
      </div>

      <div className="single-habit-body">
        {/* Filters */}
        <div className="switch-group" style={{ marginBottom: 20 }}>
          {PERIODS.map(p => (
            <div key={p.id} className={`switch-opt${period === p.id ? ' active' : ''}`} onClick={() => setPeriod(p.id)}>{p.label}</div>
          ))}
        </div>

        {all.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2em', marginBottom: 8 }}>🛍️</div>
            Nessun acquisto nel periodo selezionato
          </div>
        ) : (
          <>
            {all.map((p, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <div
                  className="item"
                  style={{ cursor: 'pointer', borderLeftColor: '#ffca28' }}
                  onClick={() => setExpanded(expanded === idx ? null : idx)}
                >
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <div style={{ fontSize: '0.75em', color: '#666', marginTop: 3 }}>{p.dateStr.split('-').reverse().join('/')}</div>
                  </div>
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}>-{p.cost}</span>
                </div>
                {expanded === idx && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0 0 12px 12px', padding: '8px 16px', fontSize: '0.82em', color: '#888', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', marginTop: -2 }}>
                    📅 Acquistato il {p.dateStr.split('-').reverse().join('/')}
                    {p.time ? ` alle ${new Date(p.time).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div style={{ marginTop: 20, padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Totale speso nel periodo</div>
              <div style={{ fontSize: '1.8em', fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>-{totalSpent}</div>
              <div style={{ fontSize: '0.75em', color: '#555', marginTop: 2 }}>{all.length} acquist{all.length === 1 ? 'o' : 'i'}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
