import assert from 'node:assert/strict'
import {
  addDays, mondayOf, weekDays, weekLabel, entriesFor, isAreaFilled,
  frequentEntries, weekSummary, intentionFor, balanceGrid,
} from './lifeAreaWeek.js'

// Date: 2026-10-05 è lunedì, 2026-10-11 domenica.
assert.equal(mondayOf('2026-10-05'), '2026-10-05')
assert.equal(mondayOf('2026-10-08'), '2026-10-05')
assert.equal(mondayOf('2026-10-11'), '2026-10-05')
assert.equal(mondayOf('2026-10-12'), '2026-10-12')
assert.equal(addDays('2026-10-31', 1), '2026-11-01')
assert.equal(addDays('2026-03-29', 1), '2026-03-30') // cambio ora legale
assert.deepEqual(weekDays('2026-10-05').slice(-1), ['2026-10-11'])
assert.equal(weekLabel('2026-10-05'), '5–11 ott')
assert.equal(weekLabel('2026-09-28'), '28 set – 4 ott')

const data = {
  lifeAreaNotes: {
    '2026-10-05': [
      { id: '1', areaId: 'f', text: 'Workout', time: '18:00:00' },
      { id: '2', areaId: 'f', text: 'Camminata', time: '20:00:00' },
      { id: '3', areaId: 'm', text: 'Meditazione', time: '07:00:00' },
    ],
    '2026-10-06': [{ id: '4', areaId: 'f', text: 'workout', time: '18:00:00' }],
    '2026-10-07': [
      { id: '5', areaId: 'f', text: 'Stretching', time: '21:00:00' },
      { id: '6', areaId: 'f', text: 'Una voce molto lunga che non deve diventare un pulsante rapido', time: '22:00:00' },
    ],
  },
  lifeAreaLog: { '2026-10-08': [{ id: 's', areaId: 'm', duration: 20, note: 'Lettura', time: '09:00:00' }] },
  lifeAreaIntentions: { '2026-10-05': { f: 'Trazioni 3 volte' } },
}
const areas = [{ id: 'f', name: 'Fisica' }, { id: 'm', name: 'Mentale' }, { id: 'r', name: 'Relazioni' }]

// entriesFor / isAreaFilled: note + sessioni, ordinate per orario
assert.deepEqual(entriesFor(data, 'f', '2026-10-05').map(e => e.text), ['Workout', 'Camminata'])
assert.equal(entriesFor(data, 'm', '2026-10-08')[0].kind, 'session')
assert.equal(isAreaFilled(data, 'm', '2026-10-08'), true)
assert.equal(isAreaFilled(data, 'r', '2026-10-05'), false)

// frequentEntries: maiuscole/minuscole unite, più frequente prima, testo della
// volta più recente, voci lunghe escluse, esclusione di quelle già scritte oggi
assert.deepEqual(frequentEntries(data.lifeAreaNotes, 'f'), ['workout', 'Stretching', 'Camminata'])
assert.deepEqual(frequentEntries(data.lifeAreaNotes, 'f', { exclude: ['Workout'] }), ['Stretching', 'Camminata'])
assert.deepEqual(frequentEntries(data.lifeAreaNotes, 'f', { limit: 1 }), ['workout'])
assert.deepEqual(frequentEntries({}, 'f'), [])

// weekSummary
const ws = weekSummary(data, areas, '2026-10-05')
assert.equal(ws[0].total, 5)
assert.equal(ws[0].daysActive, 3)
assert.equal(ws[1].total, 2)
assert.equal(ws[2].total, 0)

// intenzioni
assert.equal(intentionFor(data, '2026-10-05', 'f'), 'Trazioni 3 volte')
assert.equal(intentionFor(data, '2026-10-12', 'f'), '')

// balanceGrid: 4 settimane fino a quella del 5/10, oggi = mercoledì 7/10
const grid = balanceGrid(data, areas, '2026-10-05', '2026-10-07', 4)
assert.equal(grid[0].cells.length, 28)
assert.equal(grid[0].cells[0].date, '2026-09-14')
assert.equal(grid[0].activeDays, 3)
assert.equal(grid[1].activeDays, 1) // la sessione dell'8/10 è nel futuro rispetto a "oggi"
assert.equal(grid[0].cells.at(-1).future, true)
assert.equal(grid[0].pastDays, 24)

console.log('✔ lifeAreaWeek: tutti i controlli superati')
