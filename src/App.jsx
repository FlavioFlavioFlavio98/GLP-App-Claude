import { useEffect, useRef, useState } from 'react'
import { useApp } from './lib/store'
import { parseEntry, getItemValueAtDate, isHabitVisible, toDateString } from './lib/habitLogic'
import { applyTheme, applyUserColors } from './lib/themes'
import { getLevel } from './lib/levels'
import PinScreen, { isSessionValid } from './components/PinScreen'

import Header from './components/Header'
import ProgressCircle from './components/ProgressCircle'
import ScoreBoard from './components/ScoreBoard'
import MiniChart from './components/MiniChart'
import DateNav from './components/DateNav'
import SortableHabitList from './components/SortableHabitList'
import ReminderBanner from './components/ReminderBanner'
import LevelUpOverlay from './components/LevelUpOverlay'
import Accordion from './components/Accordion'
import PurchasedList from './components/PurchasedList'
import ShopList from './components/ShopList'
import Toast from './components/Toast'
import SplashScreen from './components/SplashScreen'
import AnimatedNumber from './components/AnimatedNumber'

import AddModal from './modals/AddModal'
import EditModal from './modals/EditModal'
import SettingsModal from './modals/SettingsModal'
import ThemeModal from './modals/ThemeModal'
import TagModal from './modals/TagModal'
import AnalyticsModal from './modals/AnalyticsModal'
import StatsModal from './modals/StatsModal'
import SingleHabitView from './modals/SingleHabitView'
import SingleRewardView from './modals/SingleRewardView'
import StatsPage from './modals/StatsPage'
import PurchaseHistoryView from './modals/PurchaseHistoryView'
import ChangePinModal from './modals/ChangePinModal'
import WeeklyView from './modals/WeeklyView'
import PdfReportModal from './modals/PdfReportModal'
import UpdateBanner from './components/UpdateBanner'
import RewardCategoryModal from './modals/RewardCategoryModal'
import ActivityLogModal from './modals/ActivityLogModal'
import EveningReviewModal from './modals/EveningReviewModal'

// Focus mode: persists per-day in localStorage
function useFocusMode(viewDate) {
  const today = toDateString(new Date())
  const storageKey = `glp_focus_${today}`

  const [focusMode, setFocusMode] = useState(() =>
    viewDate === today && localStorage.getItem(storageKey) === 'true'
  )

  useEffect(() => {
    if (viewDate !== today) setFocusMode(false)
  }, [viewDate])

  function toggle() {
    setFocusMode(prev => {
      const next = !prev
      if (viewDate === today) localStorage.setItem(storageKey, String(next))
      return next
    })
  }

  return [focusMode && viewDate === today, toggle]
}

export default function App() {
  const { state, actions } = useApp()
  const { currentUser, globalData, allUsersData, viewDate, theme, userColors, correctPin, density } = state

  const [focusMode, toggleFocusMode] = useFocusMode(viewDate)
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const [unlocked, setUnlocked] = useState(() => isSessionValid())
  const [splashGone, setSplashGone] = useState(false)

  // Apply selected theme CSS vars
  useEffect(() => { applyTheme(theme) }, [theme])

  // Apply user colors CSS vars
  useEffect(() => { applyUserColors(userColors.flavio, userColors.simona) }, [userColors])

  // Level-up detection
  useEffect(() => {
    if (!globalData) return
    const { level, name } = getLevel(globalData.score)
    const storageKey = `glp_celebrated_level_${currentUser}`
    const celebrated = parseInt(localStorage.getItem(storageKey) || '0')
    if (level > celebrated) {
      localStorage.setItem(storageKey, String(level))
      if (celebrated > 0) setLevelUpInfo({ level, name })
    }
  }, [globalData?.score, currentUser])

  // Online/offline detection
  useEffect(() => {
    function setOnline() { document.body.classList.remove('offline') }
    function setOffline() { document.body.classList.add('offline') }
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline) }
  }, [])

  const correctPinLoaded = correctPin !== null
  const pinNeeded = correctPinLoaded && !unlocked
  const dataLoaded = correctPinLoaded && unlocked && globalData !== null

  // Show splash until it signals it's done
  const showSplash = !splashGone

  return (
    <>
      {showSplash && (
        <SplashScreen
          correctPinLoaded={correctPinLoaded}
          dataLoaded={dataLoaded}
          forceHide={pinNeeded}
          onHidden={() => setSplashGone(true)}
        />
      )}

      {splashGone && (
        pinNeeded ? (
          <PinScreen correctPin={correctPin} onUnlock={() => setUnlocked(true)} />
        ) : !globalData ? null : (
          <MainContent
            state={state}
            actions={actions}
            focusMode={focusMode}
            toggleFocusMode={toggleFocusMode}
            levelUpInfo={levelUpInfo}
            setLevelUpInfo={setLevelUpInfo}
            viewDate={viewDate}
            globalData={globalData}
            allUsersData={allUsersData}
            density={density}
            currentUser={currentUser}
          />
        )
      )}
    </>
  )
}

function MainContent({ state, actions, focusMode, toggleFocusMode, levelUpInfo, setLevelUpInfo, viewDate, globalData, allUsersData, density, currentUser }) {
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

    if (isDone) dailyEarned += isMulti && level === 'min' ? rewardMin : reward
    if (isFailed) dailySpent += penalty
  })

  const purchaseCost = entry.purchases.reduce((acc, p) => acc + parseInt(p.cost || 0), 0)
  dailySpent += purchaseCost
  const net = dailyEarned - dailySpent

  function isFullyComplete(h) {
    const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
    const isDone = entry.habits.includes(sid)
    if (!isDone) return false
    const isMulti = getItemValueAtDate(h, 'isMulti', viewDate)
    if (isMulti) return (entry.habitLevels[sid] || 'max') === 'max'
    return true
  }

  const filteredRegular = focusMode ? regular.filter(h => !isFullyComplete(h)) : regular
  const filteredBonus   = focusMode ? bonus.filter(h => !isFullyComplete(h))   : bonus

  const pendingCount = isToday
    ? regular.filter(h => {
        const sid = h.id || h.name.replace(/[^a-zA-Z0-9]/g, '')
        return !entry.habits.includes(sid) && !entry.failedHabits.includes(sid)
      }).length
    : 0

  const itemProps = {
    viewDate,
    doneHabits: entry.habits,
    failedHabits: entry.failedHabits,
    habitLevels: entry.habitLevels,
    habitNotes: entry.habitNotes,
    tagsMap,
    isToday,
  }

  const allRegularDone = regular.length > 0 && filteredRegular.length === 0

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
          <AnimatedNumber value={dailyEarned} className="sum-val sum-earn" prefix="+" />
        </div>
        <div className="sum-item">
          <div className="sum-label">Spesi/Pen</div>
          <AnimatedNumber value={dailySpent} className="sum-val sum-spent" prefix="-" />
        </div>
        <div className="sum-item">
          <div className="sum-label">Netto</div>
          <AnimatedNumber
            value={net}
            className={`sum-val ${net < 0 ? 'net-neg' : net < 10 ? 'net-warn' : 'net-pos'}`}
            prefix={net > 0 ? '+' : ''}
          />
        </div>
      </div>

      {/* Section header with Focus toggle + Evening Review button */}
      <div className="section-header">
        <div className="section-title">Abitudini del Giorno</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isToday && (
            <button
              className="review-btn"
              onClick={() => actions.openModal('eveningReview')}
              title="Revisione Serale"
            >
              <span className="material-icons-round">nightlight</span>
              Revisione
            </button>
          )}
          {isToday && (
            <button
              className={`focus-toggle${focusMode ? ' active' : ''}`}
              onClick={toggleFocusMode}
              title={focusMode ? 'Disattiva Focus Mode' : 'Attiva Focus Mode'}
            >
              <span className="material-icons-round">
                {focusMode ? 'visibility_off' : 'visibility'}
              </span>
              Focus
            </button>
          )}
        </div>
      </div>

      {isToday && <ReminderBanner pendingCount={pendingCount} />}

      <div className={`habit-density-${density}`}>
        {allRegularDone ? (
          <div className="focus-complete">Tutto completato oggi! 🎉</div>
        ) : filteredRegular.length === 0 && regular.length === 0 ? (
          <div className="empty-state">Nessuna attività attiva oggi 🎉</div>
        ) : (
          <SortableHabitList habits={filteredRegular} itemProps={itemProps} />
        )}

        <Accordion label="🤷‍♂️ Abitudini Se/If (Bonus)">
          {filteredBonus.length === 0
            ? <div className="empty-state">{focusMode && bonus.length > 0 ? 'Tutti i bonus completati! 🎉' : 'Nessun bonus oggi'}</div>
            : <SortableHabitList habits={filteredBonus} itemProps={itemProps} />
          }
        </Accordion>
      </div>

      <div className="section-title" style={{ marginTop: 30 }}>Acquisti del Giorno</div>
      <PurchasedList />

      <Accordion label="🛍️ Negozio Premi" defaultOpen={false}>
        <ShopList />
      </Accordion>

      <button className="fab" onClick={() => actions.openModal('add')}>
        <span className="material-icons-round">add</span>
      </button>

      <Toast />

      <AddModal />
      <EditModal />
      <SettingsModal />
      <TagModal />
      <AnalyticsModal />
      <StatsModal />
      <SingleHabitView />
      <SingleRewardView />
      <StatsPage />
      <ThemeModal />
      <PurchaseHistoryView />
      <ChangePinModal />
      <WeeklyView />
      <PdfReportModal />
      <RewardCategoryModal />
      <ActivityLogModal />
      <EveningReviewModal />
      <UpdateBanner />

      {levelUpInfo && (
        <LevelUpOverlay
          levelInfo={levelUpInfo}
          onClose={() => setLevelUpInfo(null)}
        />
      )}
    </>
  )
}
