import SortableHabitList from './SortableHabitList'
import ReminderBanner from './ReminderBanner'
import { TIME_SLOT_OPTS } from '../lib/timeSlots'

function TimeSlotFilter({ value, onChange }) {
  const slots = [
    { v: 'all', icon: null, label: 'Tutte' },
    ...TIME_SLOT_OPTS.filter(o => o.v !== null),
  ]
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      {slots.map(s => (
        <button
          key={s.v}
          onClick={() => onChange(s.v)}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: '0.72em', cursor: 'pointer',
            background: value === s.v ? 'var(--theme-glow)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${value === s.v ? 'var(--theme-color)' : 'rgba(255,255,255,0.08)'}`,
            color: value === s.v ? 'var(--theme-color)' : '#666',
            fontWeight: value === s.v ? 700 : 400,
          }}
        >
          {s.icon && <span className="material-icons-round" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 3, color: value === s.v ? 'var(--theme-color)' : s.color }}>{s.icon}</span>}
          {s.label}
        </button>
      ))}
    </div>
  )
}

// Sezione abitudini condivisa dalle tab "Oggi" e "Abitudini"
export default function HabitsSection({
  doneRegularCount, regular, bonus,
  habitsExpanded, onToggleHabitsExpanded,
  habitSortMode, onToggleHabitSortMode,
  isReadOnly, isToday,
  focusMode, onToggleFocusMode,
  actions,
  filteredRegular, filteredBonus, allRegularDone,
  timeSlotFilter, onChangeTimeSlot,
  density, itemProps,
  minimalMode,
  bonusExpanded, onToggleBonusExpanded,
  pendingCount,
}) {
  return (
    <>
      <div className="section-header">
        <button
          onClick={onToggleHabitsExpanded}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--theme-color)' }}
        >
          <div className="section-title" style={{ margin: 0 }}>💪 Abitudini ({doneRegularCount}/{regular.length})</div>
          <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--theme-color)' }}>{habitsExpanded ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isReadOnly && (
            <button
              className={`focus-toggle${habitSortMode ? ' active' : ''}`}
              onClick={onToggleHabitSortMode}
              title={habitSortMode ? 'Esci dalla modalità ordinamento' : 'Ordina abitudini'}
            >
              <span className="material-icons-round">swap_vert</span>
              {habitSortMode ? 'Fine' : 'Ordina'}
            </button>
          )}
          {isToday && !isReadOnly && !habitSortMode && (
            <button className="review-btn" onClick={() => actions.openModal('eveningReview')} title="Revisione Serale">
              <span className="material-icons-round">nightlight</span>
              Revisione
            </button>
          )}
          {isToday && !habitSortMode && (
            <button
              className={`focus-toggle${focusMode ? ' active' : ''}`}
              onClick={onToggleFocusMode}
              title={focusMode ? 'Disattiva Focus Mode' : 'Attiva Focus Mode'}
            >
              <span className="material-icons-round">{focusMode ? 'visibility_off' : 'visibility'}</span>
              Focus
            </button>
          )}
        </div>
      </div>

      {habitsExpanded && (
        <>
          {habitSortMode && (
            <div style={{ background: 'rgba(255,202,40,0.08)', border: '1px solid rgba(255,202,40,0.2)', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: '0.78em', color: '#EF9F27', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons-round" style={{ fontSize: 16 }}>swap_vert</span>
              Modalità ordinamento attiva — trascina per riordinare
            </div>
          )}
          {isToday && !isReadOnly && !habitSortMode && <ReminderBanner pendingCount={pendingCount} />}
          {!habitSortMode && <TimeSlotFilter value={timeSlotFilter} onChange={onChangeTimeSlot} />}
          <div className={`habit-density-${density}`}>
            {allRegularDone && !habitSortMode ? (
              <div className="focus-complete">Tutto completato oggi! 🎉</div>
            ) : filteredRegular.length === 0 && regular.length === 0 ? (
              <div className="empty-state">Nessuna attività attiva oggi 🎉</div>
            ) : (
              <SortableHabitList habits={habitSortMode ? regular : filteredRegular} itemProps={{ ...itemProps, sortMode: habitSortMode }} sortMode={habitSortMode} />
            )}
            {!habitSortMode && !minimalMode && (
              <div>
                <button
                  onClick={onToggleBonusExpanded}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', color: 'var(--theme-color)' }}
                >
                  <span style={{ fontSize: '0.75em', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>🤷‍♂️ Abitudini Se/If (Bonus)</span>
                  <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--theme-color)', marginLeft: 'auto' }}>{bonusExpanded ? 'expand_less' : 'expand_more'}</span>
                </button>
                {bonusExpanded && (
                  filteredBonus.length === 0
                    ? <div className="empty-state">{focusMode && bonus.length > 0 ? 'Tutti i bonus completati! 🎉' : 'Nessun bonus oggi'}</div>
                    : <SortableHabitList habits={filteredBonus} itemProps={itemProps} sortMode={false} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
