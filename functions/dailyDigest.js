// Logica pura della mail giornaliera con le task da fare (nessun accesso a
// Firestore/rete qui: la funzione schedulata in index.js legge i dati e spedisce).

const PRIO = { high: 0, medium: 1, low: 2 }
const PRIO_LABEL = { high: 'ALTA', medium: 'MEDIA', low: 'BASSA' }
const PRIO_COLOR = { high: '#e53935', medium: '#fb8c00', low: '#43a047' }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function byPriorityThenDeadline(a, b) {
  const pa = PRIO[a.priority] ?? 1
  const pb = PRIO[b.priority] ?? 1
  if (pa !== pb) return pa - pb
  return String(a.deadline || '').localeCompare(String(b.deadline || ''))
}

// Stesso criterio della tab Task per "oggi": attive con scadenza <= oggi
// (quelle in ritardo ma non ancora marcate scadute) + scadute non chiuse.
function selectDigestTasks(tasks, todayStr) {
  const list = Array.isArray(tasks) ? tasks : []
  const today = list.filter(t => t.status === 'active' && t.deadline === todayStr).sort(byPriorityThenDeadline)
  const overdue = list.filter(t =>
    (t.status === 'active' && t.deadline < todayStr) || t.status === 'expired'
  ).sort(byPriorityThenDeadline)
  return { today, overdue }
}

function formatItalianDate(todayStr) {
  const [y, m, d] = todayStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

function formatShort(dateStr) {
  const [, m, d] = String(dateStr || '').split('-')
  return d && m ? `${parseInt(d)}/${parseInt(m)}` : ''
}

function taskLineText(t, showDeadline) {
  const parts = [`[${PRIO_LABEL[t.priority] || 'MEDIA'}] ${t.title}`]
  if (showDeadline && t.deadline) parts.push(`(scadenza ${formatShort(t.deadline)})`)
  if (t.reward) parts.push(`+${t.reward}`)
  if (t.penalty) parts.push(`-${t.penalty} se scade`)
  return parts.join(' ')
}

function taskRowHtml(t, showDeadline) {
  const color = PRIO_COLOR[t.priority] || PRIO_COLOR.medium
  const meta = []
  if (showDeadline && t.deadline) meta.push(`scadenza ${formatShort(t.deadline)}`)
  if (t.reward) meta.push(`+${t.reward} pt`)
  if (t.penalty) meta.push(`-${t.penalty} pt se scade`)
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;"></span>
    <strong>${esc(t.title)}</strong>
    <span style="color:#888;font-size:12px;"> ${esc(PRIO_LABEL[t.priority] || 'MEDIA')}${meta.length ? ' · ' + esc(meta.join(' · ')) : ''}</span>
  </td></tr>`
}

// Ritorna null se non c'è nulla da segnalare (la funzione non spedisce).
function buildDigest(tasks, todayStr, { sendWhenEmpty = false } = {}) {
  const { today, overdue } = selectDigestTasks(tasks, todayStr)
  if (!today.length && !overdue.length && !sendWhenEmpty) return null

  const dateLabel = formatItalianDate(todayStr)
  const total = today.length + overdue.length
  const subject = total === 0
    ? `Nessuna task per oggi — ${dateLabel}`
    : `${total} task da fare oggi — ${dateLabel}`

  const text = []
  text.push(`Task di ${dateLabel}`, '')
  if (today.length) { text.push('DA FARE OGGI'); today.forEach(t => text.push('• ' + taskLineText(t, false))); text.push('') }
  if (overdue.length) { text.push('IN RITARDO'); overdue.forEach(t => text.push('• ' + taskLineText(t, true))); text.push('') }
  if (!total) text.push('Nessuna task in programma. Buona giornata!')

  const section = (title, color, list, showDeadline) => list.length ? `
    <h3 style="margin:20px 0 4px;color:${color};font-size:14px;letter-spacing:.5px;">${title} (${list.length})</h3>
    <table style="width:100%;border-collapse:collapse;">${list.map(t => taskRowHtml(t, showDeadline)).join('')}</table>` : ''

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border-radius:12px;padding:20px 24px;">
      <h2 style="margin:0 0 2px;font-size:20px;">Task di oggi</h2>
      <div style="color:#888;font-size:13px;text-transform:capitalize;">${esc(dateLabel)}</div>
      ${section('DA FARE OGGI', '#1e88e5', today, false)}
      ${section('IN RITARDO', '#e53935', overdue, true)}
      ${total ? '' : '<p style="margin-top:20px;">Nessuna task in programma. Buona giornata!</p>'}
    </div>
  </div></body></html>`

  return { subject, text: text.join('\n'), html, counts: { today: today.length, overdue: overdue.length } }
}

module.exports = { selectDigestTasks, buildDigest }
