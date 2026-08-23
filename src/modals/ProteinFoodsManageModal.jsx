import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../lib/store'
import FoodIcon from '../components/FoodIcon'

export default function ProteinFoodsManageModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const { foods } = actions.getProteinData()
  const sortedFoods = useMemo(() => [...foods].sort((a, b) => a.name.localeCompare(b.name)), [foods])

  useEffect(() => {
    if (modal === 'proteinFoodsManage') {
      setEditingId(null); setEditVal(''); setNewName(''); setAdding(false)
    }
  }, [modal])

  if (modal !== 'proteinFoodsManage') return null
  if (authUserId !== 'flavio') return null

  function startEdit(f) {
    setEditingId(f.id)
    setEditVal(String(f.proteinPer100g))
  }

  async function saveEdit(foodId) {
    const val = parseFloat(editVal)
    if (isNaN(val) || val < 0) { actions.showToast('Valore non valido', '⚠️'); return }
    await actions.updateProteinFood(foodId, { proteinPer100g: Math.round(val * 10) / 10 })
    setEditingId(null)
  }

  async function handleDelete(f) {
    if (!window.confirm(`Eliminare "${f.name}" dal database alimenti? Le voci già registrate restano nello storico.`)) return
    await actions.deleteProteinFood(f.id)
  }

  async function handleAddNew() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    await actions.addProteinFoodAI(name)
    setAdding(false)
    setNewName('')
  }

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', background: 'var(--card-solid)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px 36px',
        border: '1px solid var(--card-border)',
        animation: 'slideUp 0.22s ease',
        maxHeight: '82vh', overflowY: 'auto', boxSizing: 'border-box',
      }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          🍽️ Gestisci alimenti
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nuovo alimento..."
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box' }}
          />
          <button className="btn-main" style={{ margin: 0, padding: '10px 14px' }} onClick={handleAddNew} disabled={adding || !newName.trim()}>
            {adding ? '⏳' : '+ AI'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedFoods.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
            }}>
              <FoodIcon food={f} size={30} style={{ borderRadius: 6 }} />
              <div style={{ flex: 1, fontSize: '0.88em', fontWeight: 600 }}>{f.name}</div>

              {editingId === f.id ? (
                <>
                  <input
                    type="number" step="0.1" inputMode="decimal" autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    style={{ width: 60, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: '0.85em', textAlign: 'center' }}
                  />
                  <button className="btn-icon" style={{ padding: 4 }} onClick={() => saveEdit(f.id)}>
                    <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--success)' }}>check</span>
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.8em', color: 'var(--theme-color)', fontWeight: 700, flexShrink: 0 }}>{f.proteinPer100g}g/100g</span>
                  <button className="btn-icon" style={{ padding: 4 }} onClick={() => startEdit(f)}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: '#888' }}>edit</span>
                  </button>
                </>
              )}
              <button className="btn-icon" style={{ padding: 4 }} onClick={() => handleDelete(f)}>
                <span className="material-icons-round" style={{ fontSize: 16, color: '#444' }}>delete</span>
              </button>
            </div>
          ))}

          {sortedFoods.length === 0 && (
            <div style={{ fontSize: '0.8em', color: '#888', textAlign: 'center', padding: '12px 0' }}>
              Nessun alimento ancora
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
