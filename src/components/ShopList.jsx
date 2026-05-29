import { useApp } from '../lib/store'
import { getItemValueAtDate } from '../lib/habitLogic'

export default function ShopList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return null

  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const rewards = (globalData.rewards || []).filter(r => !(r.archivedAt && viewDate >= r.archivedAt))

  function countPurchases(name) {
    let count = 0
    Object.values(globalData.dailyLogs || {}).forEach(log => {
      const purchases = Array.isArray(log) ? [] : (log.purchases || [])
      purchases.forEach(p => { if (p.name === name) count++ })
    })
    return count
  }

  if (rewards.length === 0) {
    return <div className="empty-state">Nessun premio disponibile</div>
  }

  return (
    <>
      {rewards.map(r => {
        const cost = getItemValueAtDate(r, 'cost', viewDate)
        const desc = r.description || getItemValueAtDate(r, 'description', viewDate)
        const tag = tagsMap[r.tagId]
        const count = countPurchases(r.name)
        return (
          <div className="item" key={r.id} style={tag ? { borderLeftColor: tag.color } : {}}>
            <div style={{ flex: 1 }}>
              <div className="item-name-row">
                <h3>{r.name}</h3>
                {tag && <span className="tag-pill" style={{ background: tag.color }}>{tag.name}</span>}
              </div>
              {desc ? <span className="item-desc">{desc}</span> : null}
              <div style={{ marginTop: 5 }}><span className="shop-price">-{cost}</span></div>
              {count > 0 && <span className="shop-count">Acquistato {count} volt{count === 1 ? 'a' : 'e'}</span>}
            </div>
            <div className="actions-group" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div className="actions-group">
                <button className="btn-icon" onClick={() => actions.openModal('edit', { id: r.id, type: 'reward' })}>
                  <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
                </button>
                <button className="shop-buy-btn" onClick={() => actions.buyReward(r.name, cost)}>
                  Compra
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
