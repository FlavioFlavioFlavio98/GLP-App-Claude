import { doc, updateDoc, increment } from 'firebase/firestore'
import { db } from './firebase'
import { toDateString } from './habitLogic'

export async function trackAppOpen(userId) {
  if (userId !== 'flavio') return
  const today = toDateString(new Date())
  try {
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`appUsage.${today}`]: increment(1),
    })
  } catch (e) {
    // Non critico — non blocca il resto dell'app
    console.warn('[trackAppOpen] failed:', e)
  }
}
