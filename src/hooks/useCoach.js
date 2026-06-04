import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, auth } from '../lib/firebase'
import { buildCoachContext } from '../lib/coachContext'
import { buildSystemPrompt } from '../lib/coachPrompt'

// Inizializzati una sola volta a livello modulo — evita re-creazione ad ogni render
const functions = getFunctions(app, 'europe-west1')
const coachChatFn = httpsCallable(functions, 'coachChat', { timeout: 60000 })
const coachReportFn = httpsCallable(functions, 'coachWeeklyReport', { timeout: 90000 })

export function useCoach(userData, dailyLogs, tags) {

  async function sendMessage(messages) {
    console.log('[useCoach] sendMessage — auth:', auth.currentUser?.email)
    console.log('[useCoach] messages count:', messages.length)

    let context, systemPrompt
    try {
      context = buildCoachContext(userData, dailyLogs, tags)
      systemPrompt = buildSystemPrompt(context)
      console.log('[useCoach] context built, systemPrompt length:', systemPrompt.length)
    } catch (e) {
      console.error('[useCoach] buildCoachContext/buildSystemPrompt CRASHED:', e)
      throw e
    }

    console.log('[useCoach] calling coachChatFn...')
    const result = await coachChatFn({ messages, systemPrompt })
    console.log('[useCoach] coachChatFn OK, content length:', result.data.content?.length)
    return result.data.content
  }

  async function generateWeeklyReport() {
    console.log('[useCoach] generateWeeklyReport — auth:', auth.currentUser?.email)

    let context, systemPrompt
    try {
      context = buildCoachContext(userData, dailyLogs, tags)
      systemPrompt = buildSystemPrompt(context)
      console.log('[useCoach] context built, systemPrompt length:', systemPrompt.length)
    } catch (e) {
      console.error('[useCoach] buildCoachContext/buildSystemPrompt CRASHED:', e)
      throw e
    }

    console.log('[useCoach] calling coachReportFn...')
    const result = await coachReportFn({ coachContext: context, systemPrompt })
    console.log('[useCoach] coachReportFn OK, content length:', result.data.content?.length)
    return result.data.content
  }

  return { sendMessage, generateWeeklyReport }
}
