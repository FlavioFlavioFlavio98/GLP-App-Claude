import { Chart } from './chartSetup'
import { parseEntry, getItemValueAtDate, toDateString } from './habitLogic'
import { THEMES } from './themes'

const MONTH_NAMES_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

// Build monthly data object
export function buildMonthData(userData, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  let totalEarned = 0, totalSpent = 0
  let maxNet = -Infinity, maxDay = null, minNet = Infinity, minDay = null
  let totalDone = 0, totalPurchases = 0
  let tempStreak = 0, maxStreak = 0
  const tagStats = {}, habitStats = {}, purchaseList = []

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`
    const entry = parseEntry(userData?.dailyLogs?.[dateStr])
    let dayEarned = 0, daySpent = 0

    entry.habits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return
      const isM = getItemValueAtDate(h, 'isMulti', dateStr)
      const rMin = getItemValueAtDate(h, 'rewardMin', dateStr)
      const rMax = getItemValueAtDate(h, 'reward', dateStr)
      const lvl = entry.habitLevels[hId] || 'max'
      const pts = isM && lvl === 'min' ? rMin : rMax
      dayEarned += pts; totalDone++
      const tId = h.tagId || '__none__'
      if (!tagStats[tId]) tagStats[tId] = { pts: 0, count: 0 }
      tagStats[tId].pts += pts; tagStats[tId].count++
      const hk = h.name
      if (!habitStats[hk]) habitStats[hk] = { pts: 0, done: 0, fail: 0, tagId: tId }
      habitStats[hk].pts += pts; habitStats[hk].done++
    })

    entry.failedHabits.forEach(hId => {
      const h = userData.habits?.find(x => (x.id || x.name.replace(/[^a-zA-Z0-9]/g, '')) === hId)
      if (!h) return
      daySpent += getItemValueAtDate(h, 'penalty', dateStr)
      const hk = h.name
      if (!habitStats[hk]) habitStats[hk] = { pts: 0, done: 0, fail: 0, tagId: h.tagId || '__none__' }
      habitStats[hk].fail++
    })

    entry.purchases.forEach(p => {
      daySpent += parseInt(p.cost || 0); totalPurchases++
      purchaseList.push({ dateStr, name: p.name, cost: parseInt(p.cost || 0) })
    })

    const net = dayEarned - daySpent
    totalEarned += dayEarned; totalSpent += daySpent
    if (net > maxNet) { maxNet = net; maxDay = dateStr }
    if (net < minNet) { minNet = net; minDay = dateStr }
    if (dayEarned > 0) { tempStreak++; if (tempStreak > maxStreak) maxStreak = tempStreak }
    else tempStreak = 0
    days.push({ d, dateStr, net, earned: dayEarned, spent: daySpent })
  }

  // Best time slot for the month
  const slotPts = { morning: 0, afternoon: 0, evening: 0 }
  ;(userData?.habits || []).filter(h => h.timeSlot && slotPts[h.timeSlot] !== undefined && !h.archivedAt).forEach(h => {
    const mm = String(month + 1).padStart(2, '0')
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${mm}-${String(d).padStart(2, '0')}`
      const entry = parseEntry(userData?.dailyLogs?.[dateStr])
      const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
      if (entry.habits.includes(sid)) slotPts[h.timeSlot] += getItemValueAtDate(h, 'reward', dateStr)
    }
  })
  const slotLabels = { morning: 'Mattina', afternoon: 'Pomeriggio', evening: 'Sera' }
  const bestSlotKey = Object.keys(slotPts).reduce((a, b) => slotPts[a] >= slotPts[b] ? a : b)
  const bestTimeSlot = Object.values(slotPts).some(v => v > 0) ? slotLabels[bestSlotKey] : null

  return {
    days, totalEarned, totalSpent, totalNet: totalEarned - totalSpent,
    maxNet: maxNet === -Infinity ? 0 : maxNet, maxDay,
    minNet: minNet === Infinity ? 0 : minNet, minDay,
    avgNet: daysInMonth > 0 ? Math.round((totalEarned - totalSpent) / daysInMonth) : 0,
    maxStreak, totalDone, totalPurchases,
    tagStats, habitStats, purchaseList, bestTimeSlot,
  }
}

async function renderChartToImage(type, labels, datasets, width = 760, height = 280, lightTheme = true) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  document.body.appendChild(canvas)

  // White background plugin
  const bgPlugin = {
    id: 'bg',
    beforeDraw: c => {
      const ctx = c.ctx
      ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore()
    }
  }

  const chart = new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: false, animation: false,
      plugins: { legend: { display: type === 'doughnut', labels: { color: '#333', font: { size: 11 } } }, bg: undefined },
      scales: type !== 'doughnut' ? {
        y: { grid: { color: '#eee' }, ticks: { color: '#666', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
      } : undefined,
    },
    plugins: [bgPlugin],
  })

  await new Promise(r => setTimeout(r, 120))
  const img = canvas.toDataURL('image/png')
  chart.destroy()
  canvas.remove()
  return img
}

export async function generatePdfReport({ userData, currentUser, themeId, year, month }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const theme = THEMES[themeId] || THEMES.dark
  const accent = theme.themeColor
  const userName = currentUser === 'flavio' ? 'Flavio' : 'Simona'
  const monthLabel = MONTH_NAMES_IT[month]
  const data = buildMonthData(userData, year, month)
  const tagsMap = {}
  ;(userData?.tags || []).forEach(t => { tagsMap[t.id] = t })

  const W = 210, H = 297
  const MARGIN = 18
  const COL_W = W - MARGIN * 2

  // Accent color RGB for jsPDF
  const hexToRgb = hex => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
  }
  const [ar, ag, ab] = hexToRgb(accent)

  function header(pageTitle) {
    doc.setFillColor(ar, ag, ab)
    doc.rect(0, 0, W, 12, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('GLP — Gamification Life Project', MARGIN, 8)
    doc.setFont('helvetica', 'normal')
    doc.text(`${userName} · ${monthLabel} ${year}`, W - MARGIN, 8, { align: 'right' })
    if (pageTitle) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.text(pageTitle, MARGIN, H - 8)
    }
  }

  function sectionTitle(text, y) {
    doc.setFillColor(ar, ag, ab)
    doc.rect(MARGIN, y - 4, 3, 6, 'F')
    doc.setTextColor(ar, ag, ab)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(text, MARGIN + 6, y)
    doc.setTextColor(0, 0, 0)
    return y + 8
  }

  function kv(label, value, y, valueColor = null) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(label, MARGIN, y)
    doc.setFont('helvetica', 'bold')
    if (valueColor) doc.setTextColor(...valueColor)
    else doc.setTextColor(0, 0, 0)
    doc.text(String(value), W - MARGIN, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    return y + 6
  }

  // ---- PAGE 1: COVER ----
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, 0, W, 80, 'F')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('GLP', W / 2, 40, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Gamification Life Project', W / 2, 52, { align: 'center' })

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(`${monthLabel} ${year}`, W / 2, 110, { align: 'center' })
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(ar, ag, ab)
  doc.text(userName, W / 2, 124, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  doc.text(`Report generato il ${new Date().toLocaleDateString('it', { day: '2-digit', month: 'long', year: 'numeric' })}`, W / 2, 160, { align: 'center' })
  doc.text(`Punteggio totale accumulato: ${userData?.score ?? 0} XP`, W / 2, 170, { align: 'center' })

  // ---- PAGE 2: SUMMARY ----
  doc.addPage()
  header('Pagina 2 — Riepilogo Mensile')
  let y = 24
  y = sectionTitle('Riepilogo Mensile', y)
  doc.setDrawColor(230, 230, 230)
  doc.line(MARGIN, y, W - MARGIN, y); y += 8

  y = kv('Punti guadagnati totali', `+${data.totalEarned}`, y, [0, 150, 0])
  y = kv('Penalità + acquisti', `-${data.totalSpent}`, y, [200, 0, 0])
  y = kv('Punti netti totali', (data.totalNet >= 0 ? '+' : '') + data.totalNet, y, data.totalNet >= 0 ? [0, 150, 0] : [200, 0, 0])
  y += 4; doc.line(MARGIN, y, W - MARGIN, y); y += 8
  y = kv('Giorno migliore', data.maxDay ? `${data.maxDay.split('-').reverse().join('/')} (+${data.maxNet})` : '-', y)
  y = kv('Giorno peggiore', data.minDay ? `${data.minDay.split('-').reverse().join('/')} (${data.minNet})` : '-', y)
  y = kv('Media giornaliera', `${data.avgNet >= 0 ? '+' : ''}${data.avgNet}`, y)
  y = kv('Streak più lunga', `${data.maxStreak} giorni`, y)
  y = kv('Abitudini completate', `${data.totalDone}`, y)
  y = kv('Acquisti effettuati', `${data.totalPurchases}`, y)
  if (data.bestTimeSlot) y = kv('Fascia più produttiva', data.bestTimeSlot, y)

  // ---- PAGE 3: MONTHLY CHART ----
  doc.addPage()
  header('Pagina 3 — Andamento Mensile')
  y = 24; y = sectionTitle('Andamento Punti Netti', y); y += 4

  const chartLabels = data.days.map(d => String(d.d))
  const chartData = data.days.map(d => d.net)
  const chartColors = chartData.map(v => v >= 0 ? 'rgba(76,175,80,0.7)' : 'rgba(239,83,80,0.7)')
  const chartImg = await renderChartToImage('bar', chartLabels, [{
    data: chartData, backgroundColor: chartColors, borderRadius: 2,
  }], 760, 280)
  doc.addImage(chartImg, 'PNG', MARGIN, y, COL_W, 80)

  // ---- PAGE 4: TAG ANALYSIS ----
  doc.addPage()
  header('Pagina 4 — Analisi per Categoria')
  y = 24; y = sectionTitle('Distribuzione per Tag', y); y += 4

  // Build tag data
  const tagEntries = Object.keys(data.tagStats)
    .map(tId => ({
      tId,
      name: tId === '__none__' ? 'Senza categoria' : (tagsMap[tId]?.name || '?'),
      color: tId === '__none__' ? '#999' : (tagsMap[tId]?.color || '#888'),
      ...data.tagStats[tId],
    }))
    .sort((a, b) => b.pts - a.pts)
  const tagTotal = tagEntries.reduce((acc, t) => acc + t.pts, 0)

  if (tagEntries.length > 0) {
    const donutImg = await renderChartToImage('doughnut', tagEntries.map(t => t.name), [{
      data: tagEntries.map(t => t.pts),
      backgroundColor: tagEntries.map(t => t.color), borderWidth: 0,
    }], 400, 300)
    doc.addImage(donutImg, 'PNG', W / 2 - 40, y, 80, 60)
    y += 68

    // Table headers
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 100, 100)
    doc.text('Categoria', MARGIN, y); doc.text('Punti', 120, y); doc.text('%', 148, y); doc.text('Completamenti', 165, y)
    doc.setDrawColor(200, 200, 200); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7

    doc.setFont('helvetica', 'normal')
    tagEntries.forEach(t => {
      if (y > H - 25) return
      const [tr, tg, tb] = hexToRgb(t.color)
      doc.setFillColor(tr, tg, tb); doc.circle(MARGIN + 2, y - 1, 2, 'F')
      doc.setTextColor(0, 0, 0)
      doc.text(t.name.slice(0, 28), MARGIN + 7, y)
      doc.text(String(t.pts), 120, y)
      doc.text(tagTotal > 0 ? `${Math.round(t.pts / tagTotal * 100)}%` : '0%', 148, y)
      doc.text(String(t.count), 165, y)
      doc.setDrawColor(240, 240, 240); doc.line(MARGIN, y + 2, W - MARGIN, y + 2)
      y += 7
    })
  }

  // ---- PAGE 5: HABITS LIST ----
  doc.addPage()
  header('Pagina 5 — Abitudini del Mese')
  y = 24; y = sectionTitle('Lista Abitudini', y); y += 4

  const habitEntries = Object.keys(data.habitStats)
    .map(name => ({ name, ...data.habitStats[name] }))
    .sort((a, b) => b.pts - a.pts)

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
  doc.text('Abitudine', MARGIN, y); doc.text('Punti', 110, y); doc.text('Fatte', 130, y); doc.text('Fallite', 148, y); doc.text('Win%', 168, y)
  doc.setDrawColor(200, 200, 200); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)

  habitEntries.forEach(h => {
    if (y > H - 25) { doc.addPage(); header('Pagina 5 — Abitudini (continua)'); y = 24 }
    const winPct = (h.done + h.fail) > 0 ? Math.round(h.done / (h.done + h.fail) * 100) : 0
    const tag = tagsMap[h.tagId]
    if (tag) {
      const [tr, tg, tb] = hexToRgb(tag.color)
      doc.setFillColor(tr, tg, tb); doc.circle(MARGIN + 2, y - 1, 1.5, 'F')
    }
    doc.text(h.name.slice(0, 32), MARGIN + 6, y)
    doc.text(String(h.pts), 110, y); doc.text(String(h.done), 130, y); doc.text(String(h.fail), 148, y)
    doc.setTextColor(winPct >= 70 ? 0 : 150, winPct >= 70 ? 130 : 0, 0)
    doc.text(`${winPct}%`, 168, y)
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(240, 240, 240); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
  })

  // ---- PAGE 6: PURCHASES ----
  doc.addPage()
  header('Pagina 6 — Acquisti del Mese')
  y = 24; y = sectionTitle('Storico Acquisti', y); y += 4

  if (data.purchaseList.length === 0) {
    doc.setFontSize(10); doc.setTextColor(150, 150, 150)
    doc.text('Nessun acquisto questo mese.', MARGIN, y)
  } else {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text('Data', MARGIN, y); doc.text('Premio', 50, y); doc.text('Costo', W - MARGIN, y, { align: 'right' })
    doc.setDrawColor(200, 200, 200); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)

    data.purchaseList.forEach(p => {
      if (y > H - 30) { doc.addPage(); header('Pagina 6 — Acquisti (continua)'); y = 24 }
      doc.text(p.dateStr.split('-').reverse().join('/'), MARGIN, y)
      doc.text(p.name.slice(0, 36), 50, y)
      doc.setTextColor(200, 0, 0)
      doc.text(`-${p.cost}`, W - MARGIN, y, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      doc.setDrawColor(240, 240, 240); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
    })

    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Totale speso:', MARGIN, y)
    doc.setTextColor(200, 0, 0)
    doc.text(`-${data.totalSpent}`, W - MARGIN, y, { align: 'right' })
  }

  // Save
  const filename = `GLP_${userName}_${monthLabel}${year}.pdf`
  doc.save(filename)
}
