// Verifica che la copia client (src/lib/partnerHabits.js, aggiornamento
// ottimistico) e quella server (functions/sharedHabits.js, fonte di verità)
// della transizione di stato delle abitudini restino IDENTICHE.
// Uso: node src/lib/partnerHabits.test.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'glp-ph-'))
const out = join(tmp, 'partnerHabits.mjs')
await build({ entryPoints: [join(here, 'partnerHabits.js')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
const client = await import(pathToFileURL(out).href)
const server = createRequire(import.meta.url)(join(here, '../../functions/sharedHabits.js'))

const habits = [
  { id: 'a', name: 'A', reward: 3, penalty: 1 },
  { id: 'b', name: 'B', reward: 4, rewardMin: 2, penalty: 2, isMulti: true },
  { id: 'c', name: 'C', reward: 2, penalty: 1, frequency: 3, lastDone: '2026-09-18' },
  { id: 'd', name: 'D', type: 'if', reward: 2 },
  { id: 'e', name: 'E', numericType: 'x', numericConfig: { threshold: 1 } },
  { id: 'g', name: 'G', type: 'goal' },
  { name: 'Senza id' },
]
const days = [
  undefined,
  { habits: ['a'], failedHabits: [], habitLevels: { a: 'max' } },
  { habits: ['b'], failedHabits: [], habitLevels: { b: 'min' } },
  { habits: ['b'], failedHabits: [], habitLevels: { b: 'max' } },
  { habits: [], failedHabits: ['a', 'b'], habitLevels: {} },
  ['a', 'c'], // formato legacy
]
let n = 0
for (const d of days) {
  for (const h of habits.map(x => x.id || 'Senzaid').concat(['nope'])) {
    for (const action of ['next', 'failed', 'weird']) {
      const data = { habits: JSON.parse(JSON.stringify(habits)), dailyLogs: d === undefined ? {} : { '2026-09-21': JSON.parse(JSON.stringify(d)) } }
      const c = client.applyHabitAction(data, h, '2026-09-21', action)
      const s = server.applyHabitAction(data, h, '2026-09-21', action)
      assert.deepEqual(c, s, `divergenza client/server: habit=${h} action=${action} day=${JSON.stringify(d)}`)
      n++
    }
  }
}
console.log(`✔ client e server identici su ${n} scenari (abitudini)`)

// Stesso confronto per l'acquisto premi (Negozio Premi condiviso).
const rewards = [
  { id: 'r1', name: 'Film', cost: 10 },
  { id: 'r2', name: 'Snack', cost: 2, type: 'tracked' },
  { id: 'r3', name: 'Archiviato', cost: 5, archivedAt: '2026-09-20' },
]
const rewardDays = [
  undefined,
  { purchases: [] },
  { purchases: [{ name: 'Film', cost: 10, time: 1 }] },
]
let m = 0
for (const d of rewardDays) {
  for (const r of rewards.map(x => x.id).concat(['nope'])) {
    for (const date of ['2026-09-21', '2026-09-20']) {
      const data = { rewards: JSON.parse(JSON.stringify(rewards)), dailyLogs: d === undefined ? {} : { [date]: JSON.parse(JSON.stringify(d)) } }
      const c = client.applyRewardPurchase(data, r, date, 42)
      const s = server.applyRewardPurchase(data, r, date, 42)
      assert.deepEqual(c, s, `divergenza client/server: reward=${r} date=${date} day=${JSON.stringify(d)}`)
      m++
    }
  }
}
console.log(`✔ client e server identici su ${m} scenari (premi)`)

rmSync(tmp, { recursive: true, force: true })
