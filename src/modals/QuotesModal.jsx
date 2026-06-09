import { useState } from 'react'
import { useApp } from '../lib/store'
import { quotes } from '../lib/quotes'

export default function QuotesModal() {
  const { state, actions } = useApp()
  const { modal, globalData } = state
  const [tab, setTab] = useState('liked')

  if (modal !== 'quotesModal') return null

  const quoteData = globalData?.quotes || {}
  const likedIds = quoteData.liked || []
  const dislikedIds = quoteData.disliked || []

  const likedQuotes = quotes.filter(q => likedIds.includes(q.id))
  const dislikedQuotes = quotes.filter(q => dislikedIds.includes(q.id))

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: 'flex-start', background: 'rgba(0,0,0,0.7)', paddingTop: 0 }}
      onClick={e => e.target === e.currentTarget && actions.closeModal()}
    >
      <div style={{
        width: '100%', minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={() => actions.closeModal()}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <div style={{ fontWeight: 700, fontSize: '1em', color: 'var(--text)' }}>💬 Aforismi</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '12px 16px 0', gap: 8 }}>
          {[['liked', '❤️ Preferiti', likedQuotes.length], ['hidden', '🚫 Nascosti', dislikedQuotes.length]].map(([t, l, count]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 10,
                border: `1px solid ${tab === t ? 'var(--theme-color)' : 'rgba(255,255,255,0.1)'}`,
                background: tab === t ? 'var(--theme-glow)' : 'rgba(255,255,255,0.04)',
                color: tab === t ? 'var(--theme-color)' : '#666',
                fontWeight: 700, fontSize: '0.82em', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{l} ({count})</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
          {tab === 'liked' && (
            likedQuotes.length === 0
              ? <EmptyState text="Nessun aforisma preferito ancora — usa 👍 per salvarne uno" />
              : likedQuotes.map(q => (
                <QuoteRow
                  key={q.id}
                  quote={q}
                  action="unlike"
                  actionLabel="Rimuovi"
                  onAction={() => actions.unlikeQuote(q.id)}
                />
              ))
          )}
          {tab === 'hidden' && (
            <>
              <div style={{ fontSize: '0.72em', color: '#555', marginBottom: 10 }}>
                Hai nascosto {dislikedQuotes.length} aforism{dislikedQuotes.length === 1 ? 'a' : 'i'} su {quotes.length}
              </div>
              {dislikedQuotes.length > 0 && (
                <button
                  onClick={() => actions.clearAllDisliked()}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 10, marginBottom: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#888', cursor: 'pointer', fontSize: '0.8em',
                  }}
                >
                  Ripristina tutti
                </button>
              )}
              {dislikedQuotes.length === 0
                ? <EmptyState text="Nessun aforisma nascosto" />
                : dislikedQuotes.map(q => (
                  <QuoteRow
                    key={q.id}
                    quote={q}
                    action="undislike"
                    actionLabel="Ripristina"
                    onAction={() => actions.undislikeQuote(q.id)}
                  />
                ))
              }
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="empty-state" style={{ marginTop: 40, fontSize: '0.84em' }}>{text}</div>
  )
}

function QuoteRow({ quote, actionLabel, onAction }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
      border: '1px solid var(--card-border)', marginBottom: 8,
    }}>
      <div style={{ fontStyle: 'italic', fontSize: '0.88em', color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}>
        "{quote.text}"
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72em', color: '#666' }}>— {quote.author}</span>
        <button
          onClick={onAction}
          style={{
            padding: '4px 10px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: '#888', cursor: 'pointer', fontSize: '0.72em',
          }}
        >{actionLabel}</button>
      </div>
    </div>
  )
}
