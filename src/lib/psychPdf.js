import { jsPDF } from 'jspdf'

function safeStr(val) {
  if (!val) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function fmtDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

function wrapText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export function exportSessionPdf({ session, psychProfile }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 18
  const contentW = pageW - margin * 2
  const lineH = 6
  let y = 0

  function addPage() {
    doc.addPage()
    y = margin
    // Header on each page
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text('GLP App — Sessione Psicologica', margin, 8)
    doc.text(`${session.title || 'Sessione'}`, pageW - margin, 8, { align: 'right' })
    doc.setDrawColor(220)
    doc.line(margin, 10, pageW - margin, 10)
    y = 16
  }

  function checkPageBreak(needed = 10) {
    if (y + needed > pageH - margin) { addPage() }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  y = margin + 20

  doc.setFontSize(22)
  doc.setTextColor(40)
  doc.setFont('helvetica', 'bold')
  doc.text('Sessione Psicologica', pageW / 2, y, { align: 'center' })
  y += 10

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.text(safeStr(session.title) || 'Senza titolo', pageW / 2, y, { align: 'center' })
  y += 14

  // Divider
  doc.setDrawColor(200)
  doc.line(margin + 30, y, pageW - margin - 30, y)
  y += 10

  // Stats
  doc.setFontSize(10)
  doc.setTextColor(100)
  const stats = [
    ['Data', fmtDate(session.createdAt || session.updatedAt)],
    ['Modello', session.model || 'N/A'],
    ['Messaggi', String(session.messageCount || (session.messages || []).length || 0)],
    ['Token totali', session.totalTokens ? session.totalTokens.toLocaleString('it-IT') : 'N/A'],
    ['Costo', session.totalCostEUR ? `€ ${Number(session.totalCostEUR).toFixed(4)}` : 'N/A'],
  ]
  stats.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', pageW / 2 - 30, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(value, pageW / 2 - 26, y)
    y += 7
  })

  // ── Messages ──────────────────────────────────────────────────────────────
  addPage()

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40)
  doc.text('Cronologia Messaggi', margin, y)
  y += 10

  const messages = session.messages || []
  messages.forEach((msg) => {
    checkPageBreak(20)

    const isUser = msg.role === 'user'
    const roleLabel = isUser ? 'Flavio' : 'Psicologo AI'
    const ts = msg.timestamp ? fmtDate(msg.timestamp) : ''

    // Role label
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(isUser ? 50 : 90)
    doc.text(roleLabel, margin, y)
    if (ts) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160)
      doc.text(ts, pageW - margin, y, { align: 'right' })
    }
    y += 5

    // Message content box
    const content = safeStr(msg.content)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50)
    const lines = doc.splitTextToSize(content, contentW - 4)
    const boxH = lines.length * lineH + 4

    // Check page break with full box height
    if (y + boxH + 4 > pageH - margin) { addPage(); }

    doc.setFillColor(isUser ? 245 : 252, isUser ? 249 : 252, isUser ? 255 : 252)
    doc.setDrawColor(isUser ? 200 : 220)
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'FD')
    doc.text(lines, margin + 2, y + lineH)
    y += boxH + 5
  })

  // ── Profile entry for the day ─────────────────────────────────────────────
  const sessionDate = (session.createdAt || session.updatedAt || '').slice(0, 10)
  const entry = psychProfile?.dailyEntries?.[sessionDate]
  if (entry) {
    checkPageBreak(30)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40)
    doc.text(`Entry Profilo — ${sessionDate}`, margin, y)
    y += 8

    const profileFields = [
      ['Insights', entry.insights],
      ['Pattern', entry.patterns],
      ['Domande aperte', entry.openQuestions],
    ]
    profileFields.forEach(([label, val]) => {
      if (!val) return
      checkPageBreak(15)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(70)
      doc.text(label + ':', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60)
      y = wrapText(doc, safeStr(val), margin + 2, y, contentW - 4, lineH)
      y += 4
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const title = (session.title || 'Sessione').replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').replace(/\s+/g, '_').slice(0, 40)
  const dateStr = sessionDate || new Date().toISOString().slice(0, 10)
  doc.save(`Sessione_${title}_${dateStr}.pdf`)
}
