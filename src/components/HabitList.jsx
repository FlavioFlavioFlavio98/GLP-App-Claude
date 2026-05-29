import { useApp } from '../lib/store'
import { isHabitVisible, parseEntry, toDateString } from '../lib/habitLogic'
import HabitItem from './HabitItem'

export default function HabitList() {
  const { state } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return null

  const today = toDateString(new Date())
  const isToday = viewDate === today
  const entry = parseEntry(globalData.dailyLogs?.[viewDate])
  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const regular = [], bonus = []
  ;(globalData.habits || []).forEach(h => {
    if (!isHabitVisible(h, viewDate, entry.habits, entry.failedHabits)) return
    if (h.type === 'if') bonus.push(h)
    else regular.push(h)
  })

  return { regular, bonus, entry, tagsMap, isToday }
}

export function useHabitData() {
  const { state } = useApp()
  const { globalData, viewDate } = state
  if (!globalData) return { regular: [], bonus: [], entry: { habits: [], failedHabits: [], habitLevels: {}, purchases: [] }, tagsMap: {}, isToday: false }

  const today = toDateString(new Date())
  const isToday = viewDate === today
  const entry = parseEntry(globalData.dailyLogs?.[viewDate])
  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const regular = [], bonus = []
  ;(globalData.habits || []).forEach(h => {
    if (!isHabitVisible(h, viewDate, entry.habits, entry.failedHabits)) return
    if (h.type === 'if') bonus.push(h)
    else regular.push(h)
  })

  return { regular, bonus, entry, tagsMap, isToday }
}
