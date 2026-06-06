import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../lib/store'
import HabitItem from './HabitItem'

export default function SortableHabitList({ habits, itemProps, sortMode = false }) {
  const { actions } = useApp()
  const [activeId, setActiveId] = useState(null)

  // State locale usato solo in sort mode per aggiornamento visivo immediato
  // Sincronizzato con la prop quando cambia (nuova snapshot da Firestore)
  const [localHabits, setLocalHabits] = useState(habits)
  useEffect(() => { setLocalHabits(habits) }, [habits])

  // Sensori: attivazione impossibile quando sortMode=false (distance: 99999)
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: sortMode ? { delay: 150, tolerance: 5 } : { delay: 99999, tolerance: 0 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: sortMode ? { distance: 5 } : { distance: 99999 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // In sort mode mostriamo localHabits (ordine aggiornato istantaneamente),
  // in modalità normale mostriamo habits (filtrate/ordinate da App.jsx)
  const displayHabits = sortMode ? localHabits : habits
  const activeHabit = activeId ? displayHabits.find(h => h.id === activeId) : null

  function handleDragStart(event) {
    if (!sortMode) return
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!sortMode || !over || active.id === over.id) return

    const oldIndex = localHabits.findIndex(h => h.id === active.id)
    const newIndex = localHabits.findIndex(h => h.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // 1. Aggiorna stato locale immediatamente → nessun rimbalzo visivo
    const reordered = arrayMove(localHabits, oldIndex, newIndex)
    setLocalHabits(reordered)

    // 2. Salva su Firestore (usa l'action esistente che prende activeId/overId)
    actions.reorderHabits(active.id, over.id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={displayHabits.map(h => h.id)} strategy={verticalListSortingStrategy}>
        {displayHabits.map(h => (
          <SortableHabitItem
            key={h.id}
            habit={h}
            itemProps={itemProps}
            isBeingDragged={activeId === h.id}
            sortMode={sortMode}
          />
        ))}
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
        {activeHabit && sortMode ? (
          <div style={{ opacity: 0.95, transform: 'scale(1.03)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <HabitItem habit={activeHabit} {...itemProps} isDragOverlay sortMode={sortMode} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function SortableHabitItem({ habit, itemProps, sortMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  }

  // Handle visibile e attivo solo in sort mode
  const dragHandleProps = sortMode ? { ...attributes, ...listeners } : undefined

  return (
    <div ref={setNodeRef} style={style}>
      <HabitItem
        habit={habit}
        {...itemProps}
        dragHandleProps={dragHandleProps}
        sortMode={sortMode}
      />
    </div>
  )
}
