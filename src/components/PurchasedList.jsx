import { useState } from 'react'
import { useApp } from '../lib/store'
import { parseEntry } from '../lib/habitLogic'

const LS_KEY = 'glp_purchases_open'

export default function PurchasedList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return null

  const { purchases } = parseEntry(globalData.dailyLogs?.[viewDate])
  const defaultOpen = purchases.length <= 2
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(LS_KEY)
    return stored !== null ? stored === 'true' : defaultOpen
  })

  function toggle() {
    setOpen(v => {
      localStorage.setItem(LS_KEY, String(!v))
      return !v
    })
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Accordion header */}
      <button
        onClick={toggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.95em' }}>
          🛍️ Acquistati oggi ({purchases.length})
        </span>
        <span className="material-icons-round" style={{ fontSize: 20, color: '#555', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {open && (
        <>
          {purchases.length === 0 ? (
            <div className="empty-state">Nessun acquisto oggi</div>
          ) : (
            purchases.map((p, idx) => (
              <div className="item" key={idx}>
                <div>
                  <h3>{p.name}</h3>
                  <div className="vals"><span className="val-badge val-badge-minus">Pagato: {p.cost}</span></div>
                </div>
                <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => actions.refundPurchase(idx, p.cost)}>
                  <span className="material-icons-round">undo</span>
                </button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
