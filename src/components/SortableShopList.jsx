import { useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../lib/store'
import { getItemValueAtDate } from '../lib/habitLogic'

function RewardCard({ reward, globalData, isDragOverlay, dragHandleProps, sortMode }) {
  const { actions } = useApp()
  const { state } = useApp()
  const vd = state.viewDate
  const cost = getItemValueAtDate(reward, 'cost', vd)
  const tagsMap = {}; (globalData.tags || []).forEach(t => { tagsMap[t.id] = t })
  const catMap = {}; (globalData.rewardCategories || []).forEach(c => { catMap[c.id] = c })
  const tag = tagsMap[reward.tagId]
  const cat = catMap[reward.categoryId]
  function countPurchases(name) {
    let count = 0
    Object.values(globalData.dailyLogs || {}).forEach(log => {
      const purchases = Array.isArray(log) ? [] : (log.purchases || [])
      purchases.forEach(p => { if (p.name === name) count++ })
    })
    return count
  }
  const count = countPurchases(reward.name)

  return (
    <div className="item" style={tag ? { borderLeftColor: tag.color } : {}}>
      {dragHandleProps && (
        <div className="drag-handle" {...dragHandleProps} aria-label="Riordina">
          <span className="material-icons-round">drag_indicator</span>
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div className="item-name-row">
          <h3>{reward.name}</h3>
          {tag && <span className="tag-pill" style={{ background: tag.color }}>{tag.name}</span>}
          {cat && (
            <span className="tag-pill" style={{ background: `${cat.color}33`, color: cat.color, border: `1px solid ${cat.color}66` }}>
              {cat.emoji && `${cat.emoji} `}{cat.name}
            </span>
          )}
        </div>
        {reward.description && <span className="item-desc">{reward.description}</span>}
        <div style={{ marginTop: 5 }}><span className="shop-price">-{cost}</span></div>
        {count > 0 && <span className="shop-count">Acquistato {count} volt{count === 1 ? 'a' : 'e'}</span>}
      </div>
      {!isDragOverlay && (
        <div
          className="actions-group"
          style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 5, ...(sortMode ? { opacity: 0.25, pointerEvents: 'none' } : {}) }}
        >
          <div className="actions-group">
            <button className="btn-icon" onClick={() => actions.openModal('singleReward', reward.id)}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>insights</span>
            </button>
            <button className="btn-icon" onClick={() => actions.openModal('edit', { id: reward.id, type: 'reward' })}>
              <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
            </button>
            <button className="shop-buy-btn" onClick={() => actions.buyReward(reward.name, cost)}>
              Compra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableRewardItem({ reward, globalData, sortMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reward.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.35 : 1,
    position: 'relative',
  }
  const dragHandleProps = sortMode ? { ...attributes, ...listeners } : undefined
  return (
    <div ref={setNodeRef} style={style}>
      <RewardCard reward={reward} globalData={globalData} dragHandleProps={dragHandleProps} sortMode={sortMode} />
    </div>
  )
}

export default function SortableShopList({ rewards, globalData }) {
  const { actions } = useApp()
  const [activeId, setActiveId] = useState(null)
  const [sortMode, setSortMode] = useState(false)

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: sortMode ? { delay: 150, tolerance: 5 } : { delay: 99999, tolerance: 0 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: sortMode ? { distance: 5 } : { distance: 99999 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeReward = activeId ? rewards.find(r => r.id === activeId) : null

  return (
    <>
      {/* Sort mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={() => setSortMode(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: sortMode ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${sortMode ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
            fontSize: '0.72em', color: sortMode ? 'var(--theme-color)' : '#666',
            fontWeight: sortMode ? 700 : 400,
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 14 }}>swap_vert</span>
          {sortMode ? 'Fine' : 'Ordina'}
        </button>
      </div>

      {sortMode && (
        <div style={{
          background: 'rgba(255,202,40,0.08)', border: '1px solid rgba(255,202,40,0.2)',
          borderRadius: 10, padding: '7px 12px', marginBottom: 10,
          fontSize: '0.75em', color: '#EF9F27', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="material-icons-round" style={{ fontSize: 14 }}>swap_vert</span>
          Modalità ordinamento — trascina per riordinare
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={e => { if (sortMode) setActiveId(e.active.id) }}
        onDragEnd={e => {
          const { active, over } = e
          setActiveId(null)
          if (sortMode && active.id && over?.id && active.id !== over.id) {
            actions.reorderRewards(active.id, over.id)
          }
        }}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={rewards.map(r => r.id)} strategy={verticalListSortingStrategy}>
          {rewards.map(r => (
            <SortableRewardItem key={r.id} reward={r} globalData={globalData} sortMode={sortMode} />
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
          {activeReward && sortMode && (
            <div style={{ opacity: 0.95, transform: 'scale(1.03)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
              <RewardCard reward={activeReward} globalData={globalData} isDragOverlay sortMode={sortMode} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  )
}
