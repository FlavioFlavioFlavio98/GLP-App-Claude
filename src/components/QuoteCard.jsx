import { useState } from 'react'
import { useApp } from '../lib/store'
import { quotes, getRandomQuote } from '../lib/quotes'

export default function QuoteCard() {
  const { state, actions } = useApp()
  const { currentUser, globalData } = state

  const dislikedIds = globalData?.quotes?.disliked || []
  const [currentQuote, setCurrentQuote] = useState(() =>
    getRandomQuote(quotes, dislikedIds)
  )
  const [visible, setVisible] = useState(true)

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
      const newDislikedIds = [...(globalData?.quotes?.disliked || []), currentQuote.id]
      const next = getRandomQuote(quotes, newDislikedIds)
      setCurrentQuote(next)
      setVisible(true)
    }, 300)
  }

  return (
    <div
      style={{
        background: 'rgba(var(--theme-color-rgb, 255,200,0), 0.05)',
        border: '1px solid var(--theme-glow, rgba(255,200,0,0.2))',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 8,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    >
      <div style={{
        fontStyle: 'italic',
        fontSize: '0.85em',
        color: 'var(--text-sec)',
        lineHeight: 1.45,
        marginBottom: 5,
      }}>
        "{currentQuote.text}"
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.72em', color: '#666' }}>— {currentQuote.author}</span>
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
