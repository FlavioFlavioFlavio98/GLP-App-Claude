import { useState } from 'react'
import { useApp } from '../lib/store'
import { toDateString } from '../lib/habitLogic'
import VoiceNoteModal from './VoiceNoteModal'

export default function VoiceNoteButton({ itemId, itemType = 'habit', itemName, existingNotes = [] }) {
  const { actions, state } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.85em', padding: '2px 5px', opacity: 0.45,
          color: 'var(--text)', lineHeight: 1, flexShrink: 0,
        }}
        title="Note vocali"
      >
        🎤
      </button>
      {open && (
        <VoiceNoteModal
          itemId={itemId}
          itemType={itemType}
          itemName={itemName}
          existingNotes={existingNotes}
          onClose={() => setOpen(false)}
          onSave={actions.saveVoiceNote}
          onDelete={(noteId) => actions.deleteVoiceNote(itemId, itemType, noteId)}
          viewDate={state.viewDate || toDateString(new Date())}
        />
      )}
    </>
  )
}
