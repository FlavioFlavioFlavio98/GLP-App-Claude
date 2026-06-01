// Time slot definitions — shared across App, AddModal, EditModal, HabitItem
// Kept in a dedicated file to avoid circular imports

export const TIME_SLOT_OPTS = [
  { v: null,        icon: null,          label: 'Nessuna',    color: '#666' },
  { v: 'morning',   icon: 'wb_twilight', label: 'Mattina',    color: '#EF9F27' },
  { v: 'afternoon', icon: 'light_mode',  label: 'Pomeriggio', color: '#FFD600' },
  { v: 'evening',   icon: 'bedtime',     label: 'Sera',       color: '#7986cb' },
]

export function getSlotOpt(slot) {
  return TIME_SLOT_OPTS.find(o => o.v === slot) || null
}
