import { useState } from 'react'

export default function Accordion({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <button className={`accordion-btn${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
        <span>{label}</span>
        <span className="material-icons-round" style={{ transition: '0.3s', transform: open ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>
      {open && <div className="accordion-panel">{children}</div>}
    </>
  )
}
