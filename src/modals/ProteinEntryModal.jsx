import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import FoodIcon from '../components/FoodIcon'

export default function ProteinEntryModal() {
  const { state, actions } = useApp()
  const { modal, authUserId } = state

  // step: 'food' | 'grams'
  const [step, setStep] = useState('food')
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState(null)
  const [grams, setGrams] = useState('')
  const [entryDate, setEntryDate] = useState(toDateString(new Date()))
  const [saving, setSaving] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  const { foods } = actions.getProteinData()

  const sortedFoods = useMemo(
    () => [...foods].sort((a, b) => a.name.localeCompare(b.name)),
    [foods]
  )
  const filtered = useMemo(
    () => sortedFoods.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase())),
    [sortedFoods, query]
  )
  const exactMatch = filtered.some(f => f.name.toLowerCase() === query.trim().toLowerCase())

  useEffect(() => {
    if (modal === 'proteinEntry') {
      setStep('food')
      setQuery('')
      setSelId(null)
      setGrams('')
      setEntryDate(toDateString(new Date()))
      setAddingNew(false)
    }
  }, [modal])

  if (modal !== 'proteinEntry') return null
  if (authUserId !== 'flavio') return null

  const food = foods.find(f => f.id === selId) ?? null
  const numGrams = parseFloat(grams) || 0
  const proteinPreview = food ? Math.round(numGrams * (food.proteinPer100g / 100) * 10) / 10 : 0

  function pickFood(f) {
    setSelId(f.id)
    setGrams('')
    setStep('grams')
  }

  async function handleAddNewFood() {
    const name = query.trim()
    if (!name) return
    setAddingNew(true)
    const newFood = await actions.addProteinFoodAI(name)
    setAddingNew(false)
    if (newFood) pickFood(newFood)
  }

  async function handleSave() {
    if (!food || numGrams <= 0) return
    setSaving(true)
    await actions.addProteinEntry(food, numGrams, entryDate)
    setSaving(false)
    actions.closeModal()
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, minHeight: 28 }}>
          {step === 'grams' ? (
            <button onClick={() => setStep('food')} className="btn-icon" style={{ padding: 4 }}>
              <span className="material-icons-round" style={{ fontSize: 22 }}>arrow_back</span>
            </button>
          ) : <div style={{ width: 30 }} />}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
            {step === 'food' && 'Che alimento?'}
            {step === 'grams' && food && (
              <>
                <FoodIcon food={food} size={18} />
                {food.name}
              </>
            )}
          </div>
          <div style={{ width: 30 }} />
        </div>

        {/* ── STEP 1: ricerca + lista alfabetica ── */}
        {step === 'food' && (
          <>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca alimento..."
              autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.95em', boxSizing: 'border-box', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(f => (
                <button
                  key={f.id}
                  onClick={() => pickFood(f)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text)',
                  }}
                >
                  <FoodIcon food={f} size={32} style={{ borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9em' }}>{f.name}</div>
                    <div style={{ fontSize: '0.65em', color: 'var(--theme-color)' }}>{f.proteinPer100g}g proteine/100g</div>
                  </div>
                  <span className="material-icons-round" style={{ fontSize: 18, color: '#444' }}>chevron_right</span>
                </button>
              ))}

              {filtered.length === 0 && !query.trim() && (
                <div style={{ fontSize: '0.8em', color: '#888', textAlign: 'center', padding: '12px 0' }}>
                  Nessun alimento ancora — inizia a scrivere per aggiungerne uno
                </div>
              )}

              {query.trim() && !exactMatch && (
                <button
                  onClick={handleAddNewFood}
                  disabled={addingNew}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    background: 'var(--theme-glow)', border: '1px dashed var(--theme-color)',
                    color: 'var(--theme-color)', fontWeight: 700, fontSize: '0.88em',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: 20 }}>{addingNew ? 'hourglass_empty' : 'auto_awesome'}</span>
                  {addingNew ? 'Stima proteine con AI...' : `Aggiungi "${query.trim()}" come nuovo alimento`}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── STEP 2: grammi ── */}
        {step === 'grams' && food && (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                placeholder="Grammi"
                value={grams}
                onChange={e => setGrams(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: '1.6em', fontWeight: 800, textAlign: 'center', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.68em', color: '#666', textAlign: 'center', marginTop: 6 }}>grammi</div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 16, fontSize: '1.2em', fontWeight: 800, color: 'var(--success)' }}>
              = {proteinPreview}g proteine
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data</div>
              <input
                type="date"
                value={entryDate}
                max={toDateString(new Date())}
                onChange={e => setEntryDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9em', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
            </div>

            <button
              className="btn-main"
              style={{ width: '100%', padding: '14px', fontSize: '1.05em' }}
              onClick={handleSave}
              disabled={saving || numGrams <= 0}
            >
              {saving ? '⏳ Salvataggio...' : 'Salva'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
