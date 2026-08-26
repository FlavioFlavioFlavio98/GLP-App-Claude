// Task ricorrenti: regole leggere (recurringTasks) separate dalle task vere e
// proprie (tasks) — quando un'istanza generata da una regola viene completata
// (in orario o in ritardo dalla sezione scadute), se ne genera subito una
// nuova con scadenza = data di completamento reale + N giorni. Non è un
// calendario fisso ("ogni lunedì"): l'intervallo riparte sempre dal momento
// in cui l'hai davvero completata, per esplicita richiesta di Flavio — se una
// settimanale di lunedì la fai martedì, la prossima è tra 7 giorni da martedì.
import { toDateString } from './habitLogic'

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

// Costruisce la prossima istanza (task normale, indistinguibile dalle altre
// in ogni punto dell'app/widget/estensione) a partire da una regola.
export function buildRecurringInstance(template, fromDateStr) {
  return {
    id: `task_${Date.now().toString(36)}`,
    title: template.title,
    description: template.description || '',
    deadline: addDays(fromDateStr, template.intervalDays),
    reward: template.reward,
    penalty: template.penalty,
    priority: template.priority || 'medium',
    status: 'active',
    createdAt: new Date().toISOString(),
    completedAt: null,
    expiredAt: null,
    rewardApplied: false,
    penaltyApplied: false,
    recurringId: template.id,
  }
}

// Nessuna istanza già in giro (attiva o scaduta, cioè non ancora chiusa) per
// questa regola — evita doppioni se per qualche motivo si prova a generarne
// un'altra mentre una è ancora pendente.
export function hasPendingInstance(tasks, templateId) {
  return (tasks || []).some(t => t.recurringId === templateId && t.status !== 'completed')
}
