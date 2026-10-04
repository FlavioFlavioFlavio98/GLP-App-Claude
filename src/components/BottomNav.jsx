const TABS = [
  { id: 'abitudini', icon: 'repeat',          label: 'Abitudini' },
  { id: 'task',      icon: 'checklist',       label: 'Task' },
  { id: 'workout',   icon: 'fitness_center',  label: 'Workout' },
  { id: 'diario',    icon: 'auto_stories',    label: 'Diario' },
  { id: 'aree',      icon: 'diversity_3',     label: 'Aree' },
  { id: 'altro',     icon: 'apps',            label: 'Altro' },
]

// Tab raggiungibili solo dal menu "Altro": mentre si è in una di queste la
// voce "Altro" resta evidenziata.
const ALTRO_TABS = ['altro', 'oggi', 'body', 'mente', 'nutrizione', 'pasti', 'stats']

export default function BottomNav({ currentTab, onTabChange }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 60, zIndex: 1000, maxWidth: 480, margin: '0 auto',
      background: 'var(--card-solid, #1e1e1e)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
    }}>
      {TABS.map(tab => {
        const active = tab.id === 'altro' ? ALTRO_TABS.includes(currentTab) : currentTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', cursor: 'pointer',
              color: active ? 'var(--theme-color, #ffca28)' : '#555',
              gap: 2,
              transition: 'color 0.15s',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: '0.6em', fontWeight: active ? 700 : 400, letterSpacing: active ? 0.3 : 0 }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
