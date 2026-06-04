const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Anthropic = require('@anthropic-ai/sdk')

admin.initializeApp()

const anthropicKey = defineSecret('ANTHROPIC_KEY')
const ALLOWED_EMAIL = 'flavio.rossi94@gmail.com'
const REGION = 'europe-west1'

exports.coachChat = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login richiesto')
    if (request.auth.token.email !== ALLOWED_EMAIL) throw new HttpsError('permission-denied', 'Non autorizzato')

    const { messages, systemPrompt } = request.data
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'messages è obbligatorio')
    }

    const apiKey = anthropicKey.value().trim()
    console.log('[coachChat] apiKey length:', apiKey.length, 'starts:', apiKey.slice(0, 14))

    const anthropic = new Anthropic.default({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages,
    })

    return { content: response.content[0].text }
  }
)

exports.coachWeeklyReport = onCall(
  { region: REGION, secrets: [anthropicKey], invoker: 'public' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login richiesto')
    if (request.auth.token.email !== ALLOWED_EMAIL) throw new HttpsError('permission-denied', 'Non autorizzato')

    const { coachContext, systemPrompt } = request.data
    if (!coachContext) throw new HttpsError('invalid-argument', 'coachContext è obbligatorio')

    const apiKey = anthropicKey.value().trim()
    console.log('[coachWeeklyReport] apiKey length:', apiKey.length, 'starts:', apiKey.slice(0, 14))

    const anthropic = new Anthropic.default({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt || 'Sei il coach personale di Flavio.',
      messages: [{
        role: 'user',
        content: `Analizza questi dati e genera il report settimanale:\n${JSON.stringify(coachContext, null, 2)}`,
      }],
    })

    return { content: response.content[0].text }
  }
)
