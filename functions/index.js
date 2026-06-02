const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Anthropic = require('@anthropic-ai/sdk')

admin.initializeApp()

const anthropicKey = defineSecret('ANTHROPIC_KEY')
const ALLOWED_EMAIL = 'flavio.rossi94@gmail.com'

/**
 * coachChat — proxy sicuro verso Claude API.
 * Accessibile solo dall'utente Flavio autenticato.
 * Region: europe-west1
 */
exports.coachChat = onCall(
  { region: 'europe-west1', secrets: [anthropicKey] },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login richiesto')
    }
    if (request.auth.token.email !== ALLOWED_EMAIL) {
      throw new HttpsError('permission-denied', 'Non autorizzato')
    }

    const { messages, systemPrompt } = request.data
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'messages è obbligatorio')
    }

    const apiKey = anthropicKey.value()
    if (!apiKey) {
      throw new HttpsError('internal', 'Chiave API non configurata')
    }

    const anthropic = new Anthropic.default({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt || 'Sei un coach personale di fitness e benessere per Flavio.',
      messages,
    })

    return { content: response.content[0].text }
  }
)
