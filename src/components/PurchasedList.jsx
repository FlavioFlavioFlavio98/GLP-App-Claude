import { useState } from 'react'
import { useApp } from '../lib/store'
import { parseEntry } from '../lib/habitLogic'

const LS_KEY = 'glp_purchases_expanded'

export default function PurchasedList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return null

  const { purchases } = parseEntry(globalData.dailyLogs?.[viewDate])

  // Nascondi se nessun acquisto
  if (purchases.length === 0) return null

  // Default sempre collassato; opzionalmente ricorda la preferenza
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(LS_KEY)
    return stored === 'true'
  })

  function toggle() {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem(LS_KEY, String(next))
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', padding: '8px 4px',
          fontSize: '0.78em', color: '#888',
        }}
      >
        <span>🛍️ Acquistati oggi ({purchases.length})</span>
        <span style={{ fontSize: '0.9em' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ paddingBottom: 4 }}>
          {purchases.map((p, idx) => (
            <div className="item" key={idx} style={{ fontSize: '0.85em' }}>
              <div>
                <h3 style={{ fontSize: '0.95em' }}>{p.name}</h3>
                <div className="vals"><span className="val-badge val-badge-minus">Pagato: {p.cost}</span></div>
              </div>
              <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => actions.refundPurchase(idx, p.cost)}>
                <span className="material-icons-round">undo</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
