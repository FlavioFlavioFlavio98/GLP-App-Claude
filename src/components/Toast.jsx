import { useApp } from '../lib/store'

export default function Toast() {
  const { state } = useApp()
  const { toast } = state
  if (!toast) return null
  return (
    <div className="toast">
      <span>{toast.icon}</span>
      <span>{toast.msg}</span>
    </div>
  )
}
