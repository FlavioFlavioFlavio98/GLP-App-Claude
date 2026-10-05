import assert from 'node:assert/strict'
import { mindfulGoal, mindfulTimes, mindfulCount, mindfulHistory, mindfulStreak } from './mindful.js'

const data = {
  mindfulGoal: 3,
  mindfulLog: {
    '2026-10-02': ['09:00:00', '12:00:00', '18:00:00'],
    '2026-10-03': ['09:00:00', '12:00:00', '18:00:00', '21:00:00'],
    '2026-10-04': ['20:00:00', '08:30:00', '13:00:00'],
    '2026-10-05': ['10:15:00'],
  },
}

assert.equal(mindfulGoal({}), 3)
assert.equal(mindfulGoal({ mindfulGoal: 5 }), 5)
assert.equal(mindfulGoal({ mindfulGoal: 0 }), 3)
assert.equal(mindfulCount(data, '2026-10-05'), 1)
assert.equal(mindfulCount(data, '2026-10-01'), 0)
assert.equal(mindfulCount(null, '2026-10-05'), 0)
assert.deepEqual(mindfulTimes(data, '2026-10-04'), ['08:30:00', '13:00:00', '20:00:00'])

const h = mindfulHistory(data, '2026-10-05', 7)
assert.equal(h.length, 7)
assert.equal(h[0].date, '2026-09-29')
assert.equal(h[6].date, '2026-10-05')
assert.deepEqual(h.map(d => d.count), [0, 0, 0, 3, 4, 3, 1])
assert.deepEqual(h.map(d => d.reached), [false, false, false, true, true, true, false])

// Oggi non ancora raggiunto: la serie dei giorni precedenti resta (3)
assert.equal(mindfulStreak(data, '2026-10-05'), 3)
// Oggi raggiunto: conta anche oggi
assert.equal(mindfulStreak({ ...data, mindfulLog: { ...data.mindfulLog, '2026-10-05': ['1', '2', '3'] } }, '2026-10-05'), 4)
// Ieri saltato: serie a zero
assert.equal(mindfulStreak(data, '2026-10-07'), 0)
assert.equal(mindfulStreak({}, '2026-10-05'), 0)
// Obiettivo più alto cambia cosa conta come "raggiunto"
assert.equal(mindfulStreak({ ...data, mindfulGoal: 4 }, '2026-10-04'), 1)

console.log('✔ mindful: tutti i controlli superati')
