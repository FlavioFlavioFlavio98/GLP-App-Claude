import { useState } from 'react'
import GoalSection from '../components/GoalSection'
import HabitSearch from '../components/HabitSearch'
import Accordion from '../components/Accordion'
import ShopList from '../components/ShopList'
import PurchasedList from '../components/PurchasedList'
import HabitsSection from '../components/HabitsSection'

function SearchSection() {
  const [showSearch, setShowSearch] = useState(false)
  return showSearch ? <HabitSearch onClose={() => setShowSearch(false)} /> : (
    <button className="btn-icon" onClick={() => setShowSearch(true)} style={{ marginBottom: 4 }} title="Cerca abitudine">
      <span className="material-icons-round" style={{ fontSize: 18 }}>search</span>
    </button>
  )
}

export default function AbitudiniTab({ globalData, minimalMode, isReadOnly, actions, habitsSectionProps }) {
  return (
    <>
      <GoalSection habits={globalData.habits} />
      <SearchSection />
      <HabitsSection {...habitsSectionProps} />
      {!minimalMode && (
        <>
          <Accordion label={<><span className="material-icons-round" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>redeem</span>Negozio Premi</>} defaultOpen={false}>
            <ShopList />
          </Accordion>
          <PurchasedList />
        </>
      )}
      {!isReadOnly && (
        <button className="fab" onClick={() => actions.openModal('add')}>
          <span className="material-icons-round">add</span>
        </button>
      )}
    </>
  )
}
