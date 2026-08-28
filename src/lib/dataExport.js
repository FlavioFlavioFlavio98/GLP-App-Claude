// Backup manuale scaricabile — copia di tutti i tuoi dati (task, abitudini,
// log allenamenti, storico completo) in un file JSON sotto il tuo controllo,
// indipendente da Firestore/PITR. Aggiunto dopo l'incidente del 28/8/2026 in
// cui un bug ha svuotato il documento principale: PITR e il backup orario
// coprono già bene il rischio, questo è un livello di tranquillità in più
// che l'utente decide autonomamente quando rinnovare.
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadDataBackup(globalData, dateStr) {
  const json = JSON.stringify(globalData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  triggerDownload(blob, `glp-backup-${dateStr}.json`)
}
