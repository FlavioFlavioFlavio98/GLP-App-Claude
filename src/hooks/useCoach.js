import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../lib/firebase'
import { buildCoachContext } from '../lib/coachContext'
import { buildSystemPrompt } from '../lib/coachPrompt'

const REGION = 'europe-west1'

export function useCoach(userData, dailyLogs, tags) {
  const functions = getFunctions(app, REGION)
  const coachChatFn = httpsCallable(functions, 'coachChat')
  const coachReportFn = httpsCallable(functions, 'coachWeeklyReport')

  async function sendMessage(messages) {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context)
    const result = await coachChatFn({ messages, systemPrompt })
    return result.data.content
  }

  async function generateWeeklyReport() {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context)
    const result = await coachReportFn({ coachContext: context, systemPrompt })
    return result.data.content
  }

  return { sendMessage, generateWeeklyReport }
}
