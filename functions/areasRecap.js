// Logica pura del riepilogo settimanale delle Aree: per ogni area, giorno per
// giorno, ciò che è stato scritto (note del diario + sessioni) nei 7 giorni che
// finiscono con endDateStr (incluso). Nessun accesso a Firestore/rete.

const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12))
  return dt.toISOString().slice(0, 10)
}

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return `${WEEKDAYS[dt.getUTCDay()]} ${d}/${m}`
}

function rangeLabel(startStr, endStr) {
  const [, m1, d1] = startStr.split('-').map(Number)
  const [, m2, d2] = endStr.split('-').map(Number)
  return `${d1}/${m1} – ${d2}/${m2}`
}

function entryText(e) {
  return e.kind === 'session'
    ? `${e.text ? e.text + ' ' : ''}(${e.duration} min)`
    : e.text
}

// Ritorna { subject, text, html, counts, perArea }
function buildAreasRecap(userData, endDateStr) {
  const areas = (userData?.lifeAreas || []).filter(a => a.active !== false)
  const notes = userData?.lifeAreaNotes || {}
  const sessions = userData?.lifeAreaLog || {}
  const days = Array.from({ length: 7 }, (_, i) => addDays(endDateStr, i - 6))

  const perArea = areas.map(a => {
    const byDay = days.map(date => {
      const items = [
        ...(notes[date] || []).filter(n => n.areaId === a.id).map(n => ({ kind: 'note', text: n.text, time: n.time || '' })),
        ...(sessions[date] || []).filter(s => s.areaId === a.id).map(s => ({ kind: 'session', text: s.note || '', duration: s.duration, time: s.time || '' })),
      ].sort((x, y) => x.time.localeCompare(y.time))
      return { date, items }
    }).filter(d => d.items.length > 0)
    return {
      area: a,
      byDay,
      total: byDay.reduce((n, d) => n + d.items.length, 0),
      daysActive: byDay.length,
    }
  })

  const totalEntries = perArea.reduce((n, p) => n + p.total, 0)
  const emptyAreas = perArea.filter(p => p.total === 0)
  const range = rangeLabel(days[0], days[6])
  const subject = `Riepilogo Aree della settimana (${range}) — ${totalEntries} ${totalEntries === 1 ? 'voce' : 'voci'}`

  const text = [`RIEPILOGO AREE — ${range}`, '']
  for (const p of perArea) {
    text.push(`${p.area.emoji || ''} ${p.area.name.toUpperCase()} — ${p.total} ${p.total === 1 ? 'voce' : 'voci'} in ${p.daysActive} ${p.daysActive === 1 ? 'giorno' : 'giorni'}`)
    if (!p.total) text.push('  (nessuna voce questa settimana)')
    for (const d of p.byDay) {
      text.push(`  ${dayLabel(d.date)}`)
      d.items.forEach(e => text.push(`    • ${entryText(e)}`))
    }
    text.push('')
  }
  if (emptyAreas.length) text.push(`Da riprendere la prossima settimana: ${emptyAreas.map(p => p.area.name).join(', ')}`)

  const areaHtml = perArea.map(p => {
    const color = p.area.color || '#ffca28'
    const body = p.byDay.length
      ? p.byDay.map(d => `
        <div style="margin-top:10px;"><div style="font-size:12px;color:#888;text-transform:capitalize;">${esc(dayLabel(d.date))}</div>
        <ul style="margin:4px 0 0;padding-left:18px;">${d.items.map(e => `<li style="margin:2px 0;">${esc(entryText(e))}</li>`).join('')}</ul></div>`).join('')
      : '<div style="margin-top:8px;color:#aaa;font-size:13px;">Nessuna voce questa settimana</div>'
    return `<div style="background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:12px;border-left:5px solid ${esc(color)};">
      <div style="font-size:16px;font-weight:700;">${esc(p.area.emoji || '')} ${esc(p.area.name)}
        <span style="font-weight:400;font-size:12px;color:#888;"> · ${p.total} ${p.total === 1 ? 'voce' : 'voci'} · ${p.daysActive} ${p.daysActive === 1 ? 'giorno' : 'giorni'}</span></div>
      ${body}</div>`
  }).join('')

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="margin:0 0 2px;">Riepilogo Aree</h2>
    <div style="color:#888;font-size:13px;margin-bottom:16px;">Settimana ${esc(range)} · ${totalEntries} ${totalEntries === 1 ? 'voce' : 'voci'} in totale</div>
    ${areaHtml || '<p>Nessuna area attiva.</p>'}
    ${emptyAreas.length ? `<p style="font-size:13px;color:#666;">Da riprendere la prossima settimana: <strong>${esc(emptyAreas.map(p => p.area.name).join(', '))}</strong></p>` : ''}
  </div></body></html>`

  return { subject, text: text.join('\n'), html, counts: { entries: totalEntries, areas: perArea.length, emptyAreas: emptyAreas.length }, perArea }
}

module.exports = { buildAreasRecap }
