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

// Report "quali sezioni uso di più" (Impostazioni → Uso App): conteggio
// lifetime (non per-giorno, qui interessa solo la classifica relativa, non
// l'andamento nel tempo) diviso in tre categorie per restare leggibile:
// - tabs: cambio tab principale (Oggi/Abitudini/Task/Workout/Body/Mente/...)
// - modals: apertura di una modale/schermata dedicata (ogni openModal)
// - actions: uso reale di una sotto-sezione che vive incorporata in un tab
//   insieme ad altre (es. dentro Mente: meditazione/scoperte/willpower/
//   riepilogo giorno sono tutte visibili insieme, quindi "l'ho aperta" non
//   direbbe nulla — quello che conta è averla davvero usata)
const CATEGORIES = ['tabs', 'modals', 'actions']

export async function trackSectionUsage(category, key) {
  if (!CATEGORIES.includes(category) || !key) return
  try {
    await updateDoc(doc(db, 'users', 'flavio'), {
      [`sectionUsage.${category}.${key}`]: increment(1),
    })
  } catch (e) {
    console.warn('[trackSectionUsage] failed:', e)
  }
}
