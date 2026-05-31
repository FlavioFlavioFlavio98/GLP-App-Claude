import { useState } from 'react'
import { useApp } from '../lib/store'
import { getItemValueAtDate } from '../lib/habitLogic'
import SortableShopList from './SortableShopList'

const SORT_KEY = 'glp_reward_sort'
const SORT_OPTIONS = [
  { id: 'manual', label: '⋮ Manuale' },
  { id: 'cost_asc', label: '↑ Costo' },
  { id: 'cost_desc', label: '↓ Costo' },
  { id: 'recent', label: '🕒 Recenti' },
  { id: 'popular', label: '🔥 Popolari' },
]

export default function ShopList() {
  const { state, actions } = useApp()
  const { globalData, viewDate } = state
  const [selectedCat, setSelectedCat] = useState(null)
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || 'manual')
  const isReadOnly = state.viewUserId !== state.authUserId

  if (!globalData) return null

  const tagsMap = {}; (globalData.tags || []).forEach(t => { tagsMap[t.id] = t })
  const categories = globalData.rewardCategories || []
  const catMap = {}; categories.forEach(c => { catMap[c.id] = c })

  const allRewards = (globalData.rewards || []).filter(r => !(r.archivedAt && viewDate >= r.archivedAt))

  // Category filter
  const filtered = selectedCat === null
    ? allRewards
    : selectedCat === '__none__'
      ? allRewards.filter(r => !r.categoryId || !catMap[r.categoryId])
      : allRewards.filter(r => r.categoryId === selectedCat)

  // Purchase counts and recency
  function getRewardStats(name) {
    let count = 0, lastTime = 0
    Object.values(globalData.dailyLogs || {}).forEach(log => {
      const purchases = Array.isArray(log) ? [] : (log.purchases || [])
      purchases.forEach(p => { if (p.name === name) { count++; if ((p.time || 0) > lastTime) lastTime = p.time || 0 } })
    })
    return { count, lastTime }
  }

  // Sort
  function sortRewards(arr) {
    const withStats = arr.map(r => ({ r, cost: getItemValueAtDate(r, 'cost', viewDate), stats: getRewardStats(r.name) }))
    if (sort === 'cost_asc') return withStats.sort((a, b) => a.cost - b.cost).map(x => x.r)
    if (sort === 'cost_desc') return withStats.sort((a, b) => b.cost - a.cost).map(x => x.r)
    if (sort === 'recent') return withStats.sort((a, b) => b.stats.lastTime - a.stats.lastTime).map(x => x.r)
    if (sort === 'popular') return withStats.sort((a, b) => b.stats.count - a.stats.count).map(x => x.r)
    return arr // manual
  }

  function changeSort(s) {
    setSort(s); localStorage.setItem(SORT_KEY, s)
  }

  const sortedRewards = sortRewards(filtered)

  return (
    <>
      {/* Sort selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => changeSort(opt.id)}
            style={{
              flex: '0 0 auto', padding: '4px 10px', borderRadius: 20, border: 'none',
              background: sort === opt.id ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${sort === opt.id ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
              color: sort === opt.id ? 'var(--theme-color)' : '#666',
              cursor: 'pointer', fontSize: '0.72em', fontWeight: sort === opt.id ? 700 : 400,
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="reward-cat-filter">
          <button className={`reward-cat-filter-chip${selectedCat === null ? ' active' : ''}`} onClick={() => setSelectedCat(null)}>Tutti</button>
          {categories.map(c => (
            <button key={c.id} className={`reward-cat-filter-chip${selectedCat === c.id ? ' active' : ''}`}
              style={selectedCat === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: `${c.color}66`, color: c.color }}
              onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}>
              {c.emoji && <span>{c.emoji} </span>}{c.name}
            </button>
          ))}
        </div>
      )}

      {sortedRewards.length === 0 ? (
        <div className="empty-state">{selectedCat !== null ? 'Nessun premio in questa categoria' : 'Nessun premio disponibile'}</div>
      ) : sort === 'manual' && !isReadOnly ? (
        <SortableShopList rewards={sortedRewards} globalData={globalData} />
      ) : (
        sortedRewards.map(r => {
          const cost = getItemValueAtDate(r, 'cost', viewDate)
          const tag = tagsMap[r.tagId]; const cat = catMap[r.categoryId]
          const { count } = getRewardStats(r.name)
          return (
            <div className="item" key={r.id} style={tag ? { borderLeftColor: tag.color } : {}}>
              <div style={{ flex: 1 }}>
                <div className="item-name-row">
                  <h3>{r.name}</h3>
                  {tag && <span className="tag-pill" style={{ background: tag.color }}>{tag.name}</span>}
                  {cat && <span className="tag-pill" style={{ background: `${cat.color}33`, color: cat.color, border: `1px solid ${cat.color}66` }}>{cat.emoji && `${cat.emoji} `}{cat.name}</span>}
                </div>
                {r.description && <span className="item-desc">{r.description}</span>}
                <div style={{ marginTop: 5 }}><span className="shop-price">-{cost}</span></div>
                {count > 0 && <span className="shop-count">Acquistato {count} volt{count === 1 ? 'a' : 'e'}</span>}
              </div>
              <div className="actions-group" style={{ flexDirection: 'column', gap: 5 }}>
                <div className="actions-group">
                  <button className="btn-icon" onClick={() => actions.openModal('singleReward', r.id)}>
                    <span className="material-icons-round" style={{ fontSize: 18 }}>insights</span>
                  </button>
                  <button className="btn-icon" onClick={() => actions.openModal('edit', { id: r.id, type: 'reward' })}>
                    <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
                  </button>
                  <button className="shop-buy-btn" onClick={() => actions.buyReward(r.name, cost)}>Compra</button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </>
  )
}
