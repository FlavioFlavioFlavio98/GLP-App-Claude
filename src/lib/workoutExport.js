import { Chart } from './chartSetup'
import { THEMES } from './themes'
import { toDateString } from './habitLogic'
import { getPrimaryMuscleGroup } from './workoutStats'
import { MUSCLE_GROUPS } from './muscleMapping'

const MONTH_NAMES_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const EFFORT_LABELS = { 1: 'Leggero', 2: 'Medio', 3: 'Massimo' }

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Righe piatte, una per serie, ordinate cronologicamente — usate sia dal CSV
// che dal riepilogo "sessioni recenti" del PDF.
function flattenLog(exerciseLog, quickExercises) {
  const exMap = {}
  ;(quickExercises || []).forEach(e => { exMap[e.id] = e })

  const rows = []
  Object.keys(exerciseLog || {}).sort().forEach(dateStr => {
    ;(exerciseLog[dateStr] || []).forEach(s => {
      const ex = exMap[s.exerciseId]
      const muscleKey = ex ? getPrimaryMuscleGroup(ex) : null
      rows.push({
        date: dateStr,
        time: s.time || '',
        exerciseName: ex?.name || '(esercizio eliminato)',
        muscle: muscleKey ? (MUSCLE_GROUPS[muscleKey]?.label || muscleKey) : '',
        reps: s.reps,
        load: s.load || 0,
        effort: s.effort || 1,
        pts: s.pts,
        pprAtTime: s.reps > 0 ? Math.round((s.pts / s.reps) * 100) / 100 : 0,
      })
    })
  })
  return rows
}

// ─── CSV ────────────────────────────────────────────────────────────────────
// Una riga per serie, pensato per essere importato in Google Sheets: date/ore
// separate, carico ed sforzo come colonne numeriche filtrabili.

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportWorkoutCsv({ exerciseLog, quickExercises }) {
  const rows = flattenLog(exerciseLog, quickExercises)
  const header = ['Data', 'Ora', 'Esercizio', 'Gruppo muscolare', 'Ripetizioni', 'Carico (kg)', 'Sforzo', 'Punti', 'Punti/rip']
  const lines = [header.join(';')]

  rows.forEach(r => {
    lines.push([
      r.date, r.time.slice(0, 8), csvEscape(r.exerciseName), csvEscape(r.muscle),
      r.reps, r.load, EFFORT_LABELS[r.effort] || r.effort, r.pts, r.pprAtTime,
    ].join(';'))
  })

  // BOM per far riconoscere l'UTF-8 a Excel/Google Sheets (altrimenti emoji e
  // accenti nei nomi esercizio possono apparire corrotti all'importazione)
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `GLP_Workout_${toDateString(new Date())}.csv`)
}

// ─── PDF ────────────────────────────────────────────────────────────────────

async function renderChartToImage(type, labels, datasets, width = 760, height = 280, extraScaleOpts = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  document.body.appendChild(canvas)

  const bgPlugin = {
    id: 'bg',
    beforeDraw: c => {
      const ctx = c.ctx
      ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore()
    },
  }

  const chart = new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: false, animation: false,
      plugins: { legend: { display: datasets.length > 1, labels: { color: '#333', font: { size: 11 } } } },
      scales: type !== 'doughnut' ? {
        y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { color: '#666', font: { size: 10 } }, ...extraScaleOpts },
        x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 12 } },
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

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

export async function exportWorkoutPdf({ exerciseLog, quickExercises, themeId }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const theme = THEMES[themeId] || THEMES.dark
  const [ar, ag, ab] = hexToRgb(theme.themeColor)
  const W = 210, H = 297
  const MARGIN = 18
  const COL_W = W - MARGIN * 2
  const today = new Date()
  const todayStr = toDateString(today)

  function header(pageTitle) {
    doc.setFillColor(ar, ag, ab)
    doc.rect(0, 0, W, 12, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('GLP — Report Allenamento', MARGIN, 8)
    doc.setFont('helvetica', 'normal')
    doc.text(todayStr.split('-').reverse().join('/'), W - MARGIN, 8, { align: 'right' })
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
    doc.setTextColor(...(valueColor || [0, 0, 0]))
    doc.text(String(value), W - MARGIN, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    return y + 6
  }

  const rows = flattenLog(exerciseLog, quickExercises)
  const activeEx = (quickExercises || []).filter(e => e.active !== false)

  // ── Aggregati lifetime per esercizio ──
  const perExercise = {}
  activeEx.forEach(ex => { perExercise[ex.id] = { name: ex.name, emoji: ex.emoji, reps: 0, pts: 0, sessions: 0, bestSession: 0 } })
  rows.forEach(r => {
    const ex = activeEx.find(e => e.name === r.exerciseName)
    if (!ex || !perExercise[ex.id]) return
    const p = perExercise[ex.id]
    p.reps += r.reps; p.pts += r.pts; p.sessions++
    if (r.reps > p.bestSession) p.bestSession = r.reps
  })
  const exerciseSummary = Object.values(perExercise).sort((a, b) => b.pts - a.pts)

  const lifetimeReps = rows.reduce((a, r) => a + r.reps, 0)
  const lifetimePts = Math.round(rows.reduce((a, r) => a + r.pts, 0) * 10) / 10
  const trainingDays = new Set(rows.map(r => r.date)).size
  const firstDate = rows.length > 0 ? rows[0].date : null

  // ---- PAGINA 1: COPERTINA ----
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
  doc.text('Report Allenamento', W / 2, 52, { align: 'center' })

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Flavio', W / 2, 110, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(130, 130, 130)
  doc.text(
    firstDate ? `Storico dal ${firstDate.split('-').reverse().join('/')} al ${todayStr.split('-').reverse().join('/')}` : 'Nessun dato registrato',
    W / 2, 122, { align: 'center' }
  )
  doc.text(`Report generato il ${today.toLocaleDateString('it', { day: '2-digit', month: 'long', year: 'numeric' })}`, W / 2, 160, { align: 'center' })

  if (rows.length > 0) {
    // ---- PAGINA 2: RIEPILOGO ----
    doc.addPage()
    header('Pagina 2 — Riepilogo Generale')
    let y = 24
    y = sectionTitle('Riepilogo Lifetime', y)
    doc.setDrawColor(230, 230, 230); doc.line(MARGIN, y, W - MARGIN, y); y += 8

    y = kv('Punti totali accumulati', `${lifetimePts} pt`, y, [ar, ag, ab])
    y = kv('Ripetizioni totali', `${lifetimeReps}`, y)
    y = kv('Serie registrate', `${rows.length}`, y)
    y = kv('Giorni di allenamento', `${trainingDays}`, y)
    y = kv('Media pt / giorno allenato', trainingDays > 0 ? `${Math.round(lifetimePts / trainingDays * 10) / 10} pt` : '-', y)

    y += 6
    y = sectionTitle('Per Esercizio', y)
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text('Esercizio', MARGIN, y); doc.text('Punti', 110, y); doc.text('Ripetizioni', 132, y); doc.text('Sessioni', 160, y); doc.text('Record', 180, y)
    doc.setDrawColor(200, 200, 200); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)
    exerciseSummary.forEach(ex => {
      if (y > H - 20) { doc.addPage(); header('Pagina 2 — Riepilogo (continua)'); y = 24 }
      doc.text(`${ex.emoji} ${ex.name}`.slice(0, 30), MARGIN, y)
      doc.text(String(Math.round(ex.pts * 10) / 10), 110, y)
      doc.text(String(ex.reps), 132, y)
      doc.text(String(ex.sessions), 160, y)
      doc.text(String(ex.bestSession), 180, y)
      doc.setDrawColor(240, 240, 240); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
    })

    // ---- PAGINA 3: ANDAMENTO SFORZO (ultimi 90 giorni) ----
    doc.addPage()
    header('Pagina 3 — Andamento Sforzo')
    y = 24; y = sectionTitle('Sforzo giornaliero — ultimi 90 giorni', y); y += 4

    const dayTotals = {}
    rows.forEach(r => { dayTotals[r.date] = (dayTotals[r.date] || 0) + r.pts })
    const chartDates = []
    for (let i = 89; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); chartDates.push(toDateString(d)) }
    const chartLabels = chartDates.map(d => { const [, m, dd] = d.split('-'); return `${parseInt(dd)}/${parseInt(m)}` })
    const chartData = chartDates.map(d => Math.round((dayTotals[d] || 0) * 10) / 10)
    const chartImg = await renderChartToImage('bar', chartLabels, [{ data: chartData, backgroundColor: `#${theme.themeColor.slice(1)}cc`, borderRadius: 2 }], 760, 280)
    doc.addImage(chartImg, 'PNG', MARGIN, y, COL_W, 80)

    // ---- PAGINA 4: SESSIONI RECENTI (ultimi 30 giorni) ----
    doc.addPage()
    header('Pagina 4 — Sessioni Recenti')
    y = 24; y = sectionTitle('Ultimi 30 giorni', y)
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return toDateString(d) })()
    const recentRows = rows.filter(r => r.date >= cutoff).slice().reverse()

    if (recentRows.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150, 150, 150)
      doc.text('Nessuna sessione negli ultimi 30 giorni.', MARGIN, y)
    } else {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
      doc.text('Data', MARGIN, y); doc.text('Esercizio', 42, y); doc.text('Reps', 110, y); doc.text('Carico', 128, y); doc.text('Sforzo', 150, y); doc.text('Punti', W - MARGIN, y, { align: 'right' })
      doc.setDrawColor(200, 200, 200); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 7
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)
      recentRows.forEach(r => {
        if (y > H - 20) { doc.addPage(); header('Pagina 4 — Sessioni Recenti (continua)'); y = 24 }
        doc.text(r.date.split('-').reverse().join('/'), MARGIN, y)
        doc.text(r.exerciseName.slice(0, 26), 42, y)
        doc.text(String(r.reps), 110, y)
        doc.text(r.load > 0 ? `${r.load}kg` : '-', 128, y)
        doc.text(EFFORT_LABELS[r.effort] || '-', 150, y)
        doc.text(String(r.pts), W - MARGIN, y, { align: 'right' })
        doc.setDrawColor(240, 240, 240); doc.line(MARGIN, y + 2, W - MARGIN, y + 2); y += 6
      })
    }
  }

  doc.save(`GLP_Workout_${todayStr}.pdf`)
}
