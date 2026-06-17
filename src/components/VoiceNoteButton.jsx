import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import VoiceNoteModal from './VoiceNoteModal'

export default function VoiceNoteButton({ itemId, itemType = 'habit' }) {
  const { actions, state } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.9em', padding: '2px 4px', opacity: 0.5,
          color: 'var(--text)', lineHeight: 1
        }}
        title="Aggiungi nota vocale"
      >
        🎤
      </button>
      {open && (
        <VoiceNoteModal
          itemId={itemId}
          itemType={itemType}
          onClose={() => setOpen(false)}
          onSave={actions.saveVoiceNote}
          viewDate={state.viewDate || toDateString(new Date())}
        />
      )}
    </>
  )
}
