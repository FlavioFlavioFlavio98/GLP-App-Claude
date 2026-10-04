const test = require('node:test')
const assert = require('node:assert')
const { selectDigestTasks, buildDigest } = require('./dailyDigest')

const TODAY = '2026-10-05'
const tasks = [
  { id: 'a', title: 'Bassa oggi', status: 'active', deadline: TODAY, priority: 'low' },
  { id: 'b', title: 'Alta oggi', status: 'active', deadline: TODAY, priority: 'high', reward: 10, penalty: 5 },
  { id: 'c', title: 'Futura', status: 'active', deadline: '2026-10-09', priority: 'high' },
  { id: 'd', title: 'Scaduta', status: 'expired', deadline: '2026-10-01', priority: 'medium' },
  { id: 'e', title: 'Ritardo attiva', status: 'active', deadline: '2026-10-03', priority: 'high' },
  { id: 'f', title: 'Fatta', status: 'completed', deadline: TODAY, priority: 'high' },
  { id: 'g', title: '<b>XSS</b>', status: 'active', deadline: TODAY, priority: 'medium' },
]

test('seleziona oggi e in ritardo, ordinando per priorità', () => {
  const { today, overdue } = selectDigestTasks(tasks, TODAY)
  assert.deepStrictEqual(today.map(t => t.id), ['b', 'g', 'a'])
  assert.deepStrictEqual(overdue.map(t => t.id), ['e', 'd'])
})

test('esclude future e completate', () => {
  const { today, overdue } = selectDigestTasks(tasks, TODAY)
  const ids = [...today, ...overdue].map(t => t.id)
  assert.ok(!ids.includes('c') && !ids.includes('f'))
})

test('buildDigest: oggetto, conteggi e html escapato', () => {
  const d = buildDigest(tasks, TODAY)
  assert.strictEqual(d.counts.today, 3)
  assert.strictEqual(d.counts.overdue, 2)
  assert.match(d.subject, /^5 task da fare oggi/)
  assert.ok(!d.html.includes('<b>XSS</b>'))
  assert.ok(d.html.includes('&lt;b&gt;XSS&lt;/b&gt;'))
  assert.match(d.text, /IN RITARDO/)
})

test('buildDigest: nessuna task → null (o mail vuota se richiesto)', () => {
  assert.strictEqual(buildDigest([], TODAY), null)
  assert.strictEqual(buildDigest(null, TODAY), null)
  const d = buildDigest([], TODAY, { sendWhenEmpty: true })
  assert.match(d.subject, /^Nessuna task/)
})
