// Test delle statistiche di coppia su dati costruiti a mano.
// Uso: node src/lib/coupleStats.test.mjs
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'glp-cs-'))
const out = join(tmp, 'coupleStats.mjs')
await build({ entryPoints: [join(here, 'coupleStats.js')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
const { dayStatus, perfectStreak, computeCoupleStats } = await import(pathToFileURL(out).href)

// Oggi = mercoledì 2026-09-16 (lunedì della settimana = 2026-09-14)
const TODAY = '2026-09-16'
const d = n => { const x = new Date('2026-09-16T00:00:00'); x.setDate(x.getDate() - n); const p = v => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}` }

const habit = (id, extra = {}) => ({ id, name: id.toUpperCase(), reward: 3, penalty: 1, changes: [{ date: '2026-01-01', reward: 3, penalty: 1, isMulti: false, rewardMin: 0 }], ...extra })

// Flavio: 2 abitudini (a,b). Perfetto oggi, ieri, l'altro ieri (3 giorni), poi ieri-3 manca b.
const flavio = {
  habits: [habit('a'), habit('b')],
  dailyLogs: {
    [d(0)]: { habits: ['a', 'b'] }, [d(1)]: { habits: ['a', 'b'] }, [d(2)]: { habits: ['a', 'b'] },
    [d(3)]: { habits: ['a'], failedHabits: ['b'] },
  },
}
// Simona: 1 abitudine (c). Perfetta ieri e l'altro ieri, NON ancora oggi.
const simona = {
  habits: [habit('c', { changes: [{ date: '2026-01-01', reward: 5, penalty: 2, isMulti: false, rewardMin: 0 }], reward: 5, penalty: 2 })],
  dailyLogs: { [d(1)]: { habits: ['c'] }, [d(2)]: { habits: ['c'] }, [d(3)]: { failedHabits: ['c'] } },
}

// ── dayStatus ──
let s = dayStatus(flavio, d(0))
assert.deepEqual([s.total, s.done, s.perfect, s.net], [2, 2, true, 6])
s = dayStatus(flavio, d(3))
assert.deepEqual([s.total, s.done, s.failed, s.perfect, s.net], [2, 1, 1, false, 2], 'a fatta (+3) e b fallita (-1)')
s = dayStatus(simona, d(0))
assert.deepEqual([s.total, s.done, s.perfect, s.net], [1, 0, false, 0])

// ── streak ──
assert.equal(perfectStreak(flavio, TODAY), 3, 'oggi perfetto: 3 giorni')
assert.equal(perfectStreak(simona, TODAY), 2, 'oggi non ancora perfetto: si parte da ieri')

// ── abitudine a livelli: min non è "perfetto", max sì ──
const multi = { habits: [habit('m', { isMulti: true, changes: [{ date: '2026-01-01', reward: 4, rewardMin: 2, penalty: 1, isMulti: true }] })], dailyLogs: { [d(0)]: { habits: ['m'], habitLevels: { m: 'min' } }, [d(1)]: { habits: ['m'], habitLevels: { m: 'max' } } } }
assert.equal(dayStatus(multi, d(0)).perfect, false)
assert.equal(dayStatus(multi, d(0)).done, 1)
assert.equal(dayStatus(multi, d(1)).perfect, true)
assert.equal(dayStatus(multi, d(0)).net, 2, 'livello min = rewardMin')

// ── coppia ──
const c = computeCoupleStats([{ id: 'flavio', data: flavio }, { id: 'simona', data: simona }], TODAY)
assert.equal(c.people.flavio.streak, 3)
assert.equal(c.people.simona.streak, 2)
assert.equal(c.joint.perfect30, 2, 'entrambi perfetti ieri e l\'altro ieri')
assert.equal(c.joint.streak, 2, 'oggi Simona non è perfetta: serie comune da ieri')
// settimana lun 14 → mer 16: Flavio oggi(6)+ieri(6)+ieri-1 (lun 14) = d(2)=6 → 18 ; Simona: ieri(5) + d(2)(5) = 10 (oggi 0)
assert.equal(c.people.flavio.week, 18)
assert.equal(c.people.simona.week, 10)
assert.equal(c.joint.leader, 'flavio')
assert.equal(c.joint.weekGap, 8)
assert.equal(c.trend.labels.length, 30)
assert.equal(c.trend.flavio.net[29], 6, 'ultimo elemento = oggi')
assert.ok(c.people.flavio.pct30 > 0 && c.people.flavio.pct30 <= 100)
assert.equal(c.people.flavio.insight.mostFailed.name, 'B')

// dati mancanti/vuoti non devono rompere nulla
const empty = computeCoupleStats([{ id: 'flavio', data: { habits: [], dailyLogs: {} } }, { id: 'simona', data: { habits: [], dailyLogs: {} } }], TODAY)
assert.equal(empty.people.flavio.pct30, null)
assert.equal(empty.joint.leader, null)
assert.equal(empty.joint.streak, 0)

rmSync(tmp, { recursive: true, force: true })
console.log('✔ statistiche di coppia: tutti i controlli superati')
