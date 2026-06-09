import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'
import { buildCoachContext } from '../lib/coachContext'
import { buildSystemPrompt, buildInsightSystemPrompt } from '../lib/coachPrompt'

const functions = getFunctions(getApp(), 'europe-west1')
const coachChatFn        = httpsCallable(functions, 'coachChat',              { timeout: 60000 })
const coachReportFn      = httpsCallable(functions, 'coachWeeklyReport',      { timeout: 90000 })
const summarizeFn        = httpsCallable(functions, 'summarizeConversation',   { timeout: 60000 })
const dailyInsightFn     = httpsCallable(functions, 'generateDailyInsight',   { timeout: 60000 })

const STATS_KEY = 'glp_coach_stats'

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || 'null') || {
      totalTokens: 0,
      totalCostUSD: 0,
      totalMessages: 0,
      sessionTokens: 0,
      sessionCostUSD: 0,
      lastUpdated: new Date().toISOString().slice(0, 10),
    }
  } catch {
    return {
      totalTokens: 0,
      totalCostUSD: 0,
      totalMessages: 0,
      sessionTokens: 0,
      sessionCostUSD: 0,
      lastUpdated: new Date().toISOString().slice(0, 10),
    }
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

function updateStatsWithUsage(usage) {
  const stats = loadStats()
  stats.totalTokens += usage.totalTokens || 0
  stats.totalCostUSD = parseFloat((stats.totalCostUSD + (usage.costUSD || 0)).toFixed(6))
  stats.totalMessages += 1
  stats.sessionTokens += usage.totalTokens || 0
  stats.sessionCostUSD = parseFloat((stats.sessionCostUSD + (usage.costUSD || 0)).toFixed(6))
  stats.lastUpdated = new Date().toISOString().slice(0, 10)
  saveStats(stats)
  return stats
}

export function resetSessionStats() {
  const stats = loadStats()
  stats.sessionTokens = 0
  stats.sessionCostUSD = 0
  saveStats(stats)
}

export function getCoachStats() {
  return loadStats()
}

export function useCoach(userData, dailyLogs, tags) {
  const coachMemory = userData?.coachMemory?.conversations || []
  const coachGoals  = userData?.coachGoals || []
  const recentTones = coachMemory.slice(-5).filter(c => c.toneScore)

  async function sendMessage(conversationMessages) {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context, coachMemory, coachGoals, recentTones)
    const result = await coachChatFn({ messages: conversationMessages, systemPrompt })
    const { content, usage } = result.data
    if (usage) updateStatsWithUsage(usage)
    return { content, usage }
  }

  async function generateWeeklyReport() {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildSystemPrompt(context, coachMemory, coachGoals, recentTones)
    const result = await coachReportFn({ coachContext: context, systemPrompt })
    return result.data.content
  }

  async function summarizeConversation(messages) {
    const result = await summarizeFn({ messages })
    return result.data // { summary, tone, toneScore, usage }
  }

  async function generateDailyInsight() {
    const context = buildCoachContext(userData, dailyLogs, tags)
    const systemPrompt = buildInsightSystemPrompt(context)
    const result = await dailyInsightFn({ coachContext: context, systemPrompt })
    return result.data.content
  }

  return { sendMessage, generateWeeklyReport, summarizeConversation, generateDailyInsight }
}
