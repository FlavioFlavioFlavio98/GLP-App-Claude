// Ripristina users/<id> da un file di backup scaricato dall'email settimanale.
//
//   node scripts/restore-from-backup.mjs glp-backup-2026-10-11.json                  (anteprima, non scrive)
//   node scripts/restore-from-backup.mjs glp-backup-2026-10-11.json --user flavio --apply
//
// Di default NON scrive nulla: mostra cosa verrebbe ripristinato. Con --apply
// salva prima una copia del documento attuale in ./restore-prev-<id>-<ts>.json,
// poi lo sostituisce. Per provare su emulatore: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
// (e --project demo-glp). Su produzione servono credenziali admin
// (GOOGLE_APPLICATION_CREDENTIALS) — chiedi a Claude di guidarti passo passo.
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(new URL('../functions/', import.meta.url))
const admin = require('firebase-admin')
const { deserialize } = require('./backupExport')

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const apply = args.includes('--apply')
const userIdx = args.indexOf('--user')
const only = userIdx >= 0 ? args[userIdx + 1] : null
const projIdx = args.indexOf('--project')
const projectId = projIdx >= 0 ? args[projIdx + 1] : 'gamification-life-project'
if (!file) { console.error('Uso: node scripts/restore-from-backup.mjs <file.json> [--user flavio|simona] [--apply] [--project id]'); process.exit(1) }

const backup = JSON.parse(fs.readFileSync(file, 'utf8'))
if (backup.app !== 'GLP' || !backup.users) { console.error('File non riconosciuto come backup GLP'); process.exit(1) }

admin.initializeApp({ projectId })
const db = admin.firestore()
const toTs = d => admin.firestore.Timestamp.fromDate(d)

console.log(`Backup del ${backup.exportedAt} → progetto ${projectId}${process.env.FIRESTORE_EMULATOR_HOST ? ' (EMULATORE)' : ''}`)
for (const [id, data] of Object.entries(backup.users)) {
  if (only && only !== id) continue
  if (!data) { console.log(`- ${id}: assente nel backup, salto`); continue }
  console.log(`- ${id}: ${Object.keys(data).length} campi, ${Buffer.byteLength(JSON.stringify(data)) / 1024 | 0} KB`)
  if (!apply) continue
  const ref = db.collection('users').doc(id)
  const cur = await ref.get()
  if (cur.exists) {
    const prev = `restore-prev-${id}-${Date.now()}.json`
    fs.writeFileSync(prev, JSON.stringify(cur.data()))
    console.log(`  copia dello stato attuale salvata in ${prev}`)
  }
  await ref.set(deserialize(data, toTs))
  console.log(`  ✔ users/${id} ripristinato`)
}
if (!apply) console.log('\nAnteprima: nessuna scrittura. Aggiungi --apply per ripristinare davvero.')
