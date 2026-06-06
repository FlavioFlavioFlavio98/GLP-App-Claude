import { useState } from 'react'
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
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../lib/store'
import HabitItem from './HabitItem'

export default function SortableHabitList({ habits, itemProps, sortMode = false }) {
  const { actions } = useApp()
  const [activeId, setActiveId] = useState(null)

  // Sensori attivi solo in sort mode — quando sortMode=false, nessun drag è possibile
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

  const activeHabit = activeId ? habits.find(h => h.id === activeId) : null

  function handleDragStart(event) {
    if (!sortMode) return
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!sortMode) return
    if (active.id && over?.id && active.id !== over.id) {
      actions.reorderHabits(active.id, over.id)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
        {habits.map(h => (
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

function SortableHabitItem({ habit, itemProps, isBeingDragged, sortMode }) {
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

  // Passa dragHandleProps solo se in sort mode — altrimenti l'handle non è visibile né attivo
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
