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

export default function SortableHabitList({ habits, itemProps }) {
  const { actions } = useApp()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeHabit = activeId ? habits.find(h => h.id === activeId) : null

  function handleDragStart(event) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (active.id && over?.id && active.id !== over.id) {
      actions.reorderHabits(active.id, over.id)
    }
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
        {habits.map(h => (
          <SortableHabitItem key={h.id} habit={h} itemProps={itemProps} isBeingDragged={activeId === h.id} />
        ))}
      </SortableContext>

      {/* Floating card during drag */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
        {activeHabit ? (
          <div style={{ opacity: 0.95, transform: 'scale(1.03)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <HabitItem habit={activeHabit} {...itemProps} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function SortableHabitItem({ habit, itemProps, isBeingDragged }) {
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

  return (
    <div ref={setNodeRef} style={style}>
      <HabitItem
        habit={habit}
        {...itemProps}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
