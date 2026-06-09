import { useState, useEffect } from 'react'
import { useApp } from '../lib/store'
import { quotes, getRandomQuote } from '../lib/quotes'

export default function QuoteCard() {
  const { state, actions } = useApp()
  const { currentUser, globalData } = state

  const [currentQuote, setCurrentQuote] = useState(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (currentUser !== 'flavio' || !globalData) return
    const quoteData = globalData.quotes || {}
    const dislikedIds = quoteData.disliked || []
    const lastShownId = quoteData.lastShown || null

    const cachedId = sessionStorage.getItem('currentQuoteId')
    if (cachedId) {
      const found = quotes.find(q => q.id === parseInt(cachedId))
      if (found && !dislikedIds.includes(found.id)) {
        setCurrentQuote(found)
        return
      }
    }
    const q = getRandomQuote(quotes, dislikedIds, lastShownId)
    setCurrentQuote(q)
    sessionStorage.setItem('currentQuoteId', String(q.id))
  }, [currentUser, globalData?.quotes?.lastShown]) // eslint-disable-line react-hooks/exhaustive-deps

  if (currentUser !== 'flavio' || !currentQuote) return null

  const quoteData = globalData?.quotes || {}
  const isLiked = (quoteData.liked || []).includes(currentQuote.id)
  const isDisliked = (quoteData.disliked || []).includes(currentQuote.id)

  function handleLike() {
    if (isLiked) {
      actions.unlikeQuote(currentQuote.id)
    } else {
      actions.likeQuote(currentQuote.id)
    }
  }

  function handleDislike() {
    actions.dislikeQuote(currentQuote.id)
    setVisible(false)
    setTimeout(() => {
      const dislikedIds = [...(globalData?.quotes?.disliked || []), currentQuote.id]
      const lastShownId = currentQuote.id
      const next = getRandomQuote(quotes, dislikedIds, lastShownId)
      setCurrentQuote(next)
      sessionStorage.setItem('currentQuoteId', String(next.id))
      setVisible(true)
    }, 300)
  }

  return (
    <div
      style={{
        background: 'rgba(var(--theme-color-rgb, 255,200,0), 0.05)',
        border: '1px solid var(--theme-glow, rgba(255,200,0,0.2))',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    >
      <div style={{
        fontStyle: 'italic',
        fontSize: '0.92em',
        color: 'var(--text-sec)',
        lineHeight: 1.5,
        marginBottom: 6,
      }}>
        "{currentQuote.text}"
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.75em', color: '#666' }}>— {currentQuote.author}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleLike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.1em',
              padding: '2px 4px',
              opacity: isLiked ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
            title="Mi piace"
          >👍</button>
          <button
            onClick={handleDislike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.1em',
              padding: '2px 4px',
              opacity: isDisliked ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
            title="Non mostrare più"
          >👎</button>
        </div>
      </div>
    </div>
  )
}
