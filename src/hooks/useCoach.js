import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { buildCoachContext } from '../lib/coachContext'
import { buildSystemPrompt } from '../lib/coachPrompt'

export function useCoach(userData, dailyLogs, tags) {
  // Usa getApp() per essere sicuro di prendere l'istanza già inizializzata
  const functions = getFunctions(getApp(), 'europe-west1')

  const coachChatFn = httpsCallable(functions, 'coachChat')
  const coachReportFn = httpsCallable(functions, 'coachWeeklyReport')

  const sendMessage = async (conversationMessages) => {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context)

    console.log('[useCoach] functions app name:', functions.app?.name)
    console.log('[useCoach] coachChatFn type:', typeof coachChatFn)

    const result = await coachChatFn({
      messages: conversationMessages,
      systemPrompt,
    })
    return result.data.content
  }

  const generateWeeklyReport = async () => {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context)

    console.log('[useCoach] functions app name:', functions.app?.name)
    console.log('[useCoach] coachReportFn type:', typeof coachReportFn)

    const result = await coachReportFn({
      coachContext: context,
      systemPrompt,
    })
    return result.data.content
  }

  return { sendMessage, generateWeeklyReport }
}
