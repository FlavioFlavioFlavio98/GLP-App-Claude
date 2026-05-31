import { useState } from 'react'
import { useApp } from '../lib/store'
import { getItemValueAtDate } from '../lib/habitLogic'

export default function ShopList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  const [selectedCat, setSelectedCat] = useState(null) // null = all

  if (!globalData) return null

  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const categories = globalData.rewardCategories || []
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const allRewards = (globalData.rewards || []).filter(r => !(r.archivedAt && viewDate >= r.archivedAt))

  // Filter by selected category
  const rewards = selectedCat === null
    ? allRewards
    : selectedCat === '__none__'
      ? allRewards.filter(r => !r.categoryId || !catMap[r.categoryId])
      : allRewards.filter(r => r.categoryId === selectedCat)

  function countPurchases(name) {
    let count = 0
    Object.values(globalData.dailyLogs || {}).forEach(log => {
      const purchases = Array.isArray(log) ? [] : (log.purchases || [])
      purchases.forEach(p => { if (p.name === name) count++ })
    })
    return count
  }

  return (
    <>
      {/* Category filter chips — only show if there are categories */}
      {categories.length > 0 && (
        <div className="reward-cat-filter">
          <button
            className={`reward-cat-filter-chip${selectedCat === null ? ' active' : ''}`}
            onClick={() => setSelectedCat(null)}
          >
            Tutti
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              className={`reward-cat-filter-chip${selectedCat === c.id ? ' active' : ''}`}
              style={selectedCat === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: `${c.color}66`, color: c.color }}
              onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
            >
              {c.emoji && <span>{c.emoji} </span>}
              {c.name}
            </button>
          ))}
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="empty-state">
          {selectedCat !== null ? 'Nessun premio in questa categoria' : 'Nessun premio disponibile'}
        </div>
      ) : (
        rewards.map(r => {
          const cost = getItemValueAtDate(r, 'cost', viewDate)
          const desc = r.description || getItemValueAtDate(r, 'description', viewDate)
          const tag = tagsMap[r.tagId]
          const cat = catMap[r.categoryId]
          const count = countPurchases(r.name)
          return (
            <div className="item" key={r.id} style={tag ? { borderLeftColor: tag.color } : {}}>
              <div style={{ flex: 1 }}>
                <div className="item-name-row">
                  <h3>{r.name}</h3>
                  {tag && <span className="tag-pill" style={{ background: tag.color }}>{tag.name}</span>}
                  {cat && (
                    <span className="tag-pill" style={{ background: `${cat.color}33`, color: cat.color, border: `1px solid ${cat.color}66` }}>
                      {cat.emoji && `${cat.emoji} `}{cat.name}
                    </span>
                  )}
                </div>
                {desc ? <span className="item-desc">{desc}</span> : null}
                <div style={{ marginTop: 5 }}><span className="shop-price">-{cost}</span></div>
                {count > 0 && <span className="shop-count">Acquistato {count} volt{count === 1 ? 'a' : 'e'}</span>}
              </div>
              <div className="actions-group" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <div className="actions-group">
                  <button className="btn-icon" title="Statistiche" onClick={() => actions.openModal('singleReward', r.id)}>
                    <span className="material-icons-round" style={{ fontSize: 18 }}>insights</span>
                  </button>
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
        })
      )}
    </>
  )
}
