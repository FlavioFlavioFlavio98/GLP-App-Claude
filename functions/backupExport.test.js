const test = require('node:test')
const assert = require('node:assert')
const { serialize, buildBackupFile, deserialize } = require('./backupExport')

const ts = (iso) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), toDate: () => new Date(iso) })

test('round trip: i dati tornano identici, Timestamp inclusi', () => {
  const original = {
    score: 12, tasks: [{ id: 'a', title: 'x', deadline: '2026-10-11', nested: { ok: true, n: null } }],
    updatedAt: ts('2026-10-11T10:00:00.000Z'), list: [1, 'due', { t: ts('2026-01-01T00:00:00.000Z') }],
  }
  const file = buildBackupFile({ flavio: original, simona: null }, new Date('2026-10-11T19:00:00Z'))
  const parsed = JSON.parse(file.json)
  assert.strictEqual(parsed.users.simona, null)
  const restored = deserialize(parsed.users.flavio, d => ({ ts: d.toISOString() }))
  assert.deepStrictEqual(restored.tasks, original.tasks)
  assert.strictEqual(restored.score, 12)
  assert.deepStrictEqual(restored.updatedAt, { ts: '2026-10-11T10:00:00.000Z' })
  assert.deepStrictEqual(restored.list[2].t, { ts: '2026-01-01T00:00:00.000Z' })
})

test('base64 decodifica nello stesso JSON', () => {
  const file = buildBackupFile({ flavio: { a: 1 } })
  assert.strictEqual(Buffer.from(file.base64, 'base64').toString('utf8'), file.json)
  assert.strictEqual(file.summary.flavio, 1)
})
