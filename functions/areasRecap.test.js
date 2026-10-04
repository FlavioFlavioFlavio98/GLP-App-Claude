const test = require('node:test')
const assert = require('node:assert')
const { buildAreasRecap } = require('./areasRecap')

const data = {
  lifeAreas: [
    { id: 'f', name: 'Salute fisica', emoji: '💪', color: '#2196f3', active: true },
    { id: 'm', name: 'Salute mentale', emoji: '🧠', color: '#7c4dff', active: true },
    { id: 'x', name: 'Archiviata', emoji: '📦', active: false },
  ],
  lifeAreaNotes: {
    '2026-10-05': [{ areaId: 'f', text: 'Camminata lunga', time: '20:00:00' }, { areaId: 'f', text: 'Workout', time: '18:00:00' }],
    '2026-10-11': [{ areaId: 'f', text: 'Stretching', time: '21:00:00' }],
    '2026-09-28': [{ areaId: 'f', text: 'Fuori settimana', time: '10:00:00' }],
    '2026-10-08': [{ areaId: 'x', text: 'Area archiviata', time: '10:00:00' }],
  },
  lifeAreaLog: { '2026-10-06': [{ areaId: 'f', duration: 30, note: 'Corsa', time: '07:00:00' }] },
}

test('7 giorni che finiscono alla data indicata, aree attive, ordine per orario', () => {
  const r = buildAreasRecap(data, '2026-10-11')
  assert.strictEqual(r.perArea.length, 2)
  const f = r.perArea[0]
  assert.strictEqual(f.total, 4)
  assert.strictEqual(f.daysActive, 3)
  assert.deepStrictEqual(f.byDay[0].items.map(i => i.text), ['Workout', 'Camminata lunga'])
  assert.ok(!r.text.includes('Fuori settimana'))
  assert.ok(!r.text.includes('Area archiviata'))
})

test('sessioni incluse con durata; aree vuote segnalate', () => {
  const r = buildAreasRecap(data, '2026-10-11')
  assert.match(r.text, /Corsa \(30 min\)/)
  assert.strictEqual(r.counts.emptyAreas, 1)
  assert.match(r.text, /Da riprendere la prossima settimana: Salute mentale/)
  assert.match(r.subject, /5\/10 – 11\/10/)
  assert.match(r.subject, /4 voci/)
})

test('html escapato; settimana vuota non esplode', () => {
  const evil = { lifeAreas: [{ id: 'a', name: '<i>x</i>', active: true }], lifeAreaNotes: { '2026-10-11': [{ areaId: 'a', text: '<script>1</script>' }] } }
  const r = buildAreasRecap(evil, '2026-10-11')
  assert.ok(!r.html.includes('<script>'))
  assert.ok(!r.html.includes('<i>x</i>'))
  const empty = buildAreasRecap({}, '2026-10-11')
  assert.strictEqual(empty.counts.entries, 0)
})
