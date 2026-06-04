import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { buildCoachContext } from '../lib/coachContext'
import { buildSystemPrompt, buildInsightSystemPrompt } from '../lib/coachPrompt'

const functions = getFunctions(getApp(), 'europe-west1')
const coachChatFn        = httpsCallable(functions, 'coachChat',              { timeout: 60000 })
const coachReportFn      = httpsCallable(functions, 'coachWeeklyReport',      { timeout: 90000 })
const summarizeFn        = httpsCallable(functions, 'summarizeConversation',   { timeout: 60000 })
const dailyInsightFn     = httpsCallable(functions, 'generateDailyInsight',   { timeout: 60000 })

export function useCoach(userData, dailyLogs, tags) {
  const coachMemory = userData?.coachMemory?.conversations || []
  const coachGoals  = userData?.coachGoals || []
  const recentTones = coachMemory.slice(-5).filter(c => c.toneScore)

  async function sendMessage(conversationMessages) {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context, coachMemory, coachGoals, recentTones)
    const result = await coachChatFn({ messages: conversationMessages, systemPrompt })
    return result.data.content
  }

  async function generateWeeklyReport() {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context, coachMemory, coachGoals, recentTones)
    const result = await coachReportFn({ coachContext: context, systemPrompt })
    return result.data.content
  }

  async function summarizeConversation(messages) {
    const result = await summarizeFn({ messages })
    return result.data // { summary, tone, toneScore }
  }

  async function generateDailyInsight() {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildInsightSystemPrompt(context)
    const result = await dailyInsightFn({ coachContext: context, systemPrompt })
    return result.data.content
  }

  return { sendMessage, generateWeeklyReport, summarizeConversation, generateDailyInsight }
}
