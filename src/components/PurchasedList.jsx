import { useApp } from '../lib/store'
import { parseEntry } from '../lib/habitLogic'

export default function PurchasedList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return null

  const { purchases } = parseEntry(globalData.dailyLogs?.[viewDate])

  if (purchases.length === 0) {
    return <div className="empty-state">Nessun acquisto oggi</div>
  }

  return (
    <>
      {purchases.map((p, idx) => (
        <div className="item" key={idx}>
          <div>
            <h3>{p.name}</h3>
            <div className="vals"><span className="val-badge val-badge-minus">Pagato: {p.cost}</span></div>
          </div>
          <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => actions.refundPurchase(idx, p.cost)}>
            <span className="material-icons-round">undo</span>
          </button>
        </div>
      ))}
    </>
  )
}
