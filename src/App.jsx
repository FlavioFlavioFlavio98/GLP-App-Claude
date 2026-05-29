import { useEffect } from 'react'
import { useApp } from './lib/store'
import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString } from './lib/habitLogic'

import Header from './components/Header'
import ProgressCircle from './components/ProgressCircle'
import ScoreBoard from './components/ScoreBoard'
import MiniChart from './components/MiniChart'
import DateNav from './components/DateNav'
import HabitItem from './components/HabitItem'
import Accordion from './components/Accordion'
import PurchasedList from './components/PurchasedList'
import ShopList from './components/ShopList'
import Toast from './components/Toast'

import AddModal from './modals/AddModal'
import EditModal from './modals/EditModal'
import SettingsModal from './modals/SettingsModal'
import TagModal from './modals/TagModal'
import AnalyticsModal from './modals/AnalyticsModal'
import StatsModal from './modals/StatsModal'
import SingleHabitView from './modals/SingleHabitView'
import SingleRewardView from './modals/SingleRewardView'
import StatsPage from './modals/StatsPage'

export default function App() {
  const { state, actions } = useApp()
  const { currentUser, globalData, allUsersData, viewDate } = state

  // Apply theme CSS vars and online/offline class
  useEffect(() => {
    const root = document.documentElement
    if (currentUser === 'flavio') {
      root.style.setProperty('--theme-color', '#ffca28')
      root.style.setProperty('--theme-glow', 'rgba(255,202,40,0.3)')
    } else {
      root.style.setProperty('--theme-color', '#d05ce3')
      root.style.setProperty('--theme-glow', 'rgba(208,92,227,0.3)')
    }
  }, [currentUser])

  useEffect(() => {
    function setOnline() { document.body.classList.remove('offline') }
    function setOffline() { document.body.classList.add('offline') }
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline) }
  }, [])

  if (!globalData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: '2em' }}>🔥</div>
        <div style={{ color: '#666' }}>Caricamento GLP...</div>
      </div>
    )
  }

  const today = toDateString(new Date())
  const isToday = viewDate === today
  const entry = parseEntry(globalData.dailyLogs?.[viewDate])
  const tagsMap = {}
  ;(globalData.tags || []).forEach(t => { tagsMap[t.id] = t })

  const regular = [], bonus = []
  let dailyTotalPot = 0, dailyEarned = 0, dailySpent = 0

  ;(globalData.habits || []).forEach(h => {
    if (!isHabitVisible(h, viewDate, entry.habits, entry.failedHabits)) return
    const stableId = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const reward = getItemValueAtDate(h, 'reward', viewDate)
    const rewardMin = getItemValueAtDate(h, 'rewardMin', viewDate)
    const penalty = getItemValueAtDate(h, 'penalty', viewDate)
    const isMulti = getItemValueAtDate(h, 'isMulti', viewDate)
    const isDone = entry.habits.includes(stableId)
    const isFailed = entry.failedHabits.includes(stableId)
    const level = entry.habitLevels[stableId] || 'max'

    if (h.type === 'if') {
      bonus.push(h)
    } else {
      regular.push(h)
      dailyTotalPot += reward
    }

    if (isDone) {
      dailyEarned += isMulti && level === 'min' ? rewardMin : reward
    }
    if (isFailed) dailySpent += penalty
  })

  const purchaseCost = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  dailySpent += purchaseCost
  const net = dailyEarned - dailySpent

  const itemProps = { viewDate, doneHabits: entry.habits, failedHabits: entry.failedHabits, habitLevels: entry.habitLevels, tagsMap, isToday }

  return (
    <>
      <Header />

      <div className="dashboard-top">
        <ProgressCircle earned={dailyEarned} total={dailyTotalPot} />
        <ScoreBoard />
      </div>

      <MiniChart allUsersData={allUsersData} />

      <DateNav />

      <div className="daily-summary">
        <div className="sum-item">
          <div className="sum-label">Guadagnati</div>
          <div className="sum-val sum-earn">+{dailyEarned}</div>
        </div>
        <div className="sum-item">
          <div className="sum-label">Spesi/Pen</div>
          <div className="sum-val sum-spent">-{dailySpent}</div>
        </div>
        <div className="sum-item">
          <div className="sum-label">Netto</div>
          <div className={`sum-val ${net < 0 ? 'net-neg' : net < 10 ? 'net-warn' : 'net-pos'}`}>
            {net > 0 ? '+' : ''}{net}
          </div>
        </div>
      </div>

      <div className="section-title">Abitudini del Giorno</div>
      {regular.length === 0
        ? <div className="empty-state">Nessuna attività attiva oggi 🎉</div>
        : regular.map(h => <HabitItem key={h.id} habit={h} {...itemProps} />)
      }

      <Accordion label="🤷‍♂️ Abitudini Se/If (Bonus)">
        {bonus.length === 0
          ? <div className="empty-state">Nessun bonus oggi</div>
          : bonus.map(h => <HabitItem key={h.id} habit={h} {...itemProps} />)
        }
      </Accordion>

      <div className="section-title" style={{ marginTop: 30 }}>Acquisti del Giorno</div>
      <PurchasedList />

      <Accordion label="🛍️ Negozio Premi" defaultOpen={false}>
        <ShopList />
      </Accordion>

      <button className="fab" onClick={() => actions.openModal('add')}>
        <span className="material-icons-round">add</span>
      </button>

      <Toast />

      {/* Modals */}
      <AddModal />
      <EditModal />
      <SettingsModal />
      <TagModal />
      <AnalyticsModal />
      <StatsModal />
      <SingleHabitView />
      <SingleRewardView />
      <StatsPage />
    </>
  )
}
