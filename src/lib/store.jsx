import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { db } from './firebase'
import {
  doc, onSnapshot, updateDoc, setDoc, getDoc, deleteDoc,
  arrayUnion, collection, getDocs,
} from 'firebase/firestore'
import { toDateString, getItemValueAtDate } from './habitLogic'

const AppContext = createContext(null)
const DispatchContext = createContext(null)

const USERS = ['flavio', 'simona']

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER_DATA':
      return {
        ...state,
        allUsersData: { ...state.allUsersData, [action.user]: action.data },
        globalData: action.user === state.currentUser ? action.data : state.globalData,
      }
    case 'SWITCH_USER':
      localStorage.setItem('glp_user', action.user)
      return {
        ...state,
        currentUser: action.user,
        globalData: state.allUsersData[action.user] || null,
      }
    case 'SET_VIEW_DATE':
      return { ...state, viewDate: action.date }
    case 'SET_TOAST':
      return { ...state, toast: action.payload }
    case 'SET_MODAL':
      return { ...state, modal: action.name, modalPayload: action.payload || null }
    case 'CLOSE_MODAL':
      return { ...state, modal: null, modalPayload: null }
    default:
      return state
  }
}

const initialState = {
  currentUser: localStorage.getItem('glp_user') || 'flavio',
  globalData: null,
  allUsersData: { flavio: null, simona: null },
  viewDate: toDateString(new Date()),
  toast: null,
  modal: null,
  modalPayload: null,
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const toastTimer = useRef(null)

  // Firebase listeners for both users
  useEffect(() => {
    const unsubs = USERS.map(u =>
      onSnapshot(doc(db, 'users', u), snap => {
        if (snap.exists()) {
          dispatch({ type: 'SET_USER_DATA', user: u, data: snap.data() })
        }
      })
    )
    // Ensure both user docs exist
    USERS.forEach(async u => {
      const ref = doc(db, 'users', u)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, { score: 0, habits: [], rewards: [], history: [], dailyLogs: {}, tags: [] })
      }
    })
    return () => unsubs.forEach(u => u())
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (state.toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 2600)
    }
  }, [state.toast])

  const actions = {
    showToast(msg, icon = 'ℹ️') {
      dispatch({ type: 'SET_TOAST', payload: { msg, icon } })
    },
    vibrate(type) {
      if (!navigator.vibrate) return
      if (type === 'light') navigator.vibrate(30)
      if (type === 'heavy') navigator.vibrate([50, 50])
    },
    switchUser(u) {
      if (u === state.currentUser) return
      dispatch({ type: 'SWITCH_USER', user: u })
      actions.vibrate('light')
    },
    setViewDate(dateStr) {
      dispatch({ type: 'SET_VIEW_DATE', date: dateStr })
    },
    openModal(name, payload) {
      dispatch({ type: 'SET_MODAL', name, payload })
    },
    closeModal() {
      dispatch({ type: 'CLOSE_MODAL' })
    },

    // --- HABIT ACTIONS ---
    async setHabitStatus(habitId, action) {
      const { currentUser, globalData, viewDate } = state
      actions.vibrate('light')
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      let entry = {
        habits: [...(raw.habits || [])],
        failedHabits: [...(raw.failedHabits || [])],
        habitLevels: { ...(raw.habitLevels || {}) },
        purchases: raw.purchases || [],
      }

      const habitsArr = [...(globalData.habits || [])]
      const habitIndex = habitsArr.findIndex(h => (h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')) === habitId)
      const habitObj = habitsArr[habitIndex]
      if (!habitObj) return

      const isMulti = getItemValueAtDate(habitObj, 'isMulti', viewDate)
      const rewardMax = getItemValueAtDate(habitObj, 'reward', viewDate)
      const rewardMin = getItemValueAtDate(habitObj, 'rewardMin', viewDate)
      const penalty = getItemValueAtDate(habitObj, 'penalty', viewDate)

      const wasDone = entry.habits.includes(habitId)
      const wasLevel = entry.habitLevels[habitId] || 'max'
      let score = globalData.score

      // Undo previous state
      if (wasDone) {
        score -= isMulti && wasLevel === 'min' ? rewardMin : rewardMax
        entry.habits = entry.habits.filter(id => id !== habitId)
        delete entry.habitLevels[habitId]
      }
      if (entry.failedHabits.includes(habitId)) {
        score += penalty
        entry.failedHabits = entry.failedHabits.filter(id => id !== habitId)
      }

      let actionType = 'neutral'
      if (action === 'failed') {
        entry.failedHabits.push(habitId)
        score -= penalty
        actionType = 'failed'
      } else if (action === 'next') {
        if (!wasDone) {
          entry.habits.push(habitId)
          if (isMulti) {
            entry.habitLevels[habitId] = 'min'
            score += rewardMin
          } else {
            entry.habitLevels[habitId] = 'max'
            score += rewardMax
            actionType = 'done'
          }
        } else if (isMulti && wasLevel === 'min') {
          entry.habits.push(habitId)
          entry.habitLevels[habitId] = 'max'
          score += rewardMax
          actionType = 'done'
        }
        if (habitIndex >= 0 && entry.habits.includes(habitId)) {
          habitsArr[habitIndex] = { ...habitsArr[habitIndex], lastDone: viewDate }
        }
      }

      dailyLogs[viewDate] = entry
      await updateDoc(ref, { score, dailyLogs, habits: habitsArr })
      await actions._logHistory(currentUser, score)

      if (actionType === 'done') {
        import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: [currentUser === 'flavio' ? '#ffca28' : '#d05ce3'] }))
        actions.showToast('Completata!', '✅')
      } else if (actionType === 'failed') {
        actions.showToast('Segnata come fallita', '❌')
      }
    },

    async buyReward(name, cost) {
      const { currentUser, globalData, viewDate } = state
      if (globalData.score < cost) {
        if (!window.confirm(`Saldo insufficiente (${globalData.score}). Andrai in negativo. Continuare?`)) return
      } else {
        if (!window.confirm(`Comprare ${name} per ${cost}?`)) return
      }
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      let raw = dailyLogs[viewDate] || {}
      if (Array.isArray(raw)) raw = { habits: raw, failedHabits: [], habitLevels: {}, purchases: [] }
      const purchases = [...(raw.purchases || []), { name, cost, time: Date.now() }]
      dailyLogs[viewDate] = { habits: raw.habits || [], failedHabits: raw.failedHabits || [], habitLevels: raw.habitLevels || {}, purchases }
      const newScore = globalData.score - parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(currentUser, newScore)
      actions.vibrate('heavy')
      import('canvas-confetti').then(m => m.default({ shapes: ['circle'], colors: ['#4caf50'] }))
      actions.showToast('Acquisto effettuato!', '🛍️')
    },

    async refundPurchase(idx, cost) {
      if (!window.confirm('Annullare acquisto e rimborsare punti?')) return
      const { currentUser, globalData, viewDate } = state
      const ref = doc(db, 'users', currentUser)
      const dailyLogs = { ...(globalData.dailyLogs || {}) }
      const raw = dailyLogs[viewDate]
      const purchases = [...(raw.purchases || [])]
      purchases.splice(idx, 1)
      dailyLogs[viewDate] = { ...raw, purchases }
      const newScore = globalData.score + parseInt(cost)
      await updateDoc(ref, { score: newScore, dailyLogs })
      await actions._logHistory(currentUser, newScore)
      actions.vibrate('light')
      actions.showToast('Rimborsato!', '↩️')
    },

    async addItem(itemData, itemType) {
      const { currentUser } = state
      const ref = doc(db, 'users', currentUser)
      if (itemType === 'habit') {
        await updateDoc(ref, { habits: arrayUnion(itemData) })
      } else {
        await updateDoc(ref, { rewards: arrayUnion(itemData) })
      }
      actions.vibrate('light')
      actions.showToast('Salvato!', '💾')
    },

    async saveEdit(updatedItem, itemType) {
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
      if (itemType === 'habit') {
        const habits = globalData.habits.map(h => h.id === updatedItem.id ? updatedItem : h)
        await updateDoc(ref, { habits })
      } else {
        const rewards = globalData.rewards.map(r => r.id === updatedItem.id ? updatedItem : r)
        await updateDoc(ref, { rewards })
      }
      actions.showToast('Salvato!', '✏️')
    },

    async deleteItem(id, itemType) {
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
      if (itemType === 'habit') {
        const habits = globalData.habits.filter(h => h.id !== id)
        await updateDoc(ref, { habits })
      } else {
        const rewards = globalData.rewards.filter(r => r.id !== id)
        await updateDoc(ref, { rewards })
      }
      actions.showToast('Eliminato', '🗑️')
    },

    async archiveItem(id, itemType, dateStr) {
      const { currentUser, globalData } = state
      const ref = doc(db, 'users', currentUser)
      const listKey = itemType === 'habit' ? 'habits' : 'rewards'
      const list = globalData[listKey].map(i => i.id === id ? { ...i, archivedAt: dateStr } : i)
      await updateDoc(ref, { [listKey]: list })
      actions.showToast('Archiviato', '📦')
    },

    async saveTags(tags) {
      const { currentUser } = state
      await updateDoc(doc(db, 'users', currentUser), { tags })
      actions.showToast('Tag salvato', '🏷️')
    },

    async exportData() {
      actions.showToast('Backup...', '⏳')
      try {
        const snap = await getDocs(collection(db, 'users'))
        const backup = {}
        snap.forEach(d => { backup[d.id] = d.data() })
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `GLP_Backup_${toDateString(new Date())}.json`
        a.click()
        URL.revokeObjectURL(url)
        actions.showToast('Backup completato!', '✅')
      } catch (e) {
        console.error(e)
        actions.showToast('Errore backup', '❌')
      }
    },

    async importData(file) {
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        if (!window.confirm('Sovrascrivere tutti i dati?')) return
        actions.showToast('Ripristino...', '⏳')
        for (const userId in backup) {
          if (Object.prototype.hasOwnProperty.call(backup, userId)) {
            await setDoc(doc(db, 'users', userId), backup[userId])
          }
        }
        actions.showToast('Fatto!', '✅')
        setTimeout(() => window.location.reload(), 1500)
      } catch (e) {
        console.error(e)
        actions.showToast('File non valido', '❌')
      }
    },

    async hardReset() {
      const code = window.prompt('Scrivi RESET per confermare:')
      if (code !== 'RESET') return
      const { currentUser } = state
      await deleteDoc(doc(db, 'users', currentUser))
      window.location.reload()
    },

    async _logHistory(user, score) {
      try {
        const ref = doc(db, 'users', user)
        const snap = await getDoc(ref)
        if (!snap.exists()) return
        const hist = [...(snap.data().history || [])]
        hist.push({ date: new Date().toISOString(), score })
        if (hist.length > 500) hist.shift()
        await updateDoc(ref, { history: hist })
      } catch (e) { /* non-critical */ }
    },
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
