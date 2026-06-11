import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { Schema } from '@google/generative-ai'
import type { AnalysisResult, GeminiAnalysisPayload, RiskLevel, Sentiment } from '@/types'

// Overridable via GEMINI_MODEL so you can switch to a cheaper/faster model
// (e.g. gemini-2.0-flash-lite, gemini-1.5-flash) without a code change.
// Trim guards against an empty/whitespace env value falling through.
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash'

// Annotated as Schema so TypeScript narrows the discriminated union correctly
const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: 'Concise 1–2 sentence summary of where this conversation currently stands.',
    },
    riskLevel: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      description: 'Risk of losing this client.',
    },
    riskReasons: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Specific reasons for the risk level. Empty array when risk is LOW.',
    },
    nextAction: {
      type: SchemaType.STRING,
      description: 'The single most important action the manager should take next. Be specific.',
    },
    lostReason: {
      type: SchemaType.STRING,
      description: 'Why the client was lost or is very likely lost. Omit field if not applicable.',
    },
    sentiment: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
      description: 'Overall client sentiment in this conversation.',
    },
  },
  required: ['summary', 'riskLevel', 'riskReasons', 'nextAction', 'sentiment'],
}

const VALID_RISK = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const VALID_SENTIMENT = new Set<string>(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])

function validateResult(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini returned a non-object response body')
  }

  const r = raw as Record<string, unknown>

  const riskLevel = String(r.riskLevel ?? '').toUpperCase()
  const sentiment = String(r.sentiment ?? '').toUpperCase()

  if (!VALID_RISK.has(riskLevel)) {
    throw new Error(`Gemini returned unexpected riskLevel: "${riskLevel}"`)
  }
  if (!VALID_SENTIMENT.has(sentiment)) {
    throw new Error(`Gemini returned unexpected sentiment: "${sentiment}"`)
  }

  const riskReasons = Array.isArray(r.riskReasons)
    ? r.riskReasons.map(String).filter(Boolean)
    : []

  const lostReason =
    typeof r.lostReason === 'string' && r.lostReason.trim()
      ? r.lostReason.trim()
      : undefined

  return {
    summary:    String(r.summary    ?? '').trim() || 'No summary available.',
    riskLevel:  riskLevel as RiskLevel,
    riskReasons,
    nextAction: String(r.nextAction ?? '').trim() || 'Review the conversation.',
    lostReason,
    sentiment:  sentiment as Sentiment,
  }
}

function buildPrompt(payload: GeminiAnalysisPayload): string {
  const { channel, contactName, messages } = payload

  const lines = messages.map((m) => {
    const role = m.direction === 'INBOUND' ? `CLIENT (${contactName})` : 'MANAGER'
    const time = new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ')
    // Truncate long messages to stay within token budget
    const body = m.content.length > 600 ? m.content.slice(0, 600) + '…' : m.content
    return `[${time}] ${role}: ${body}`
  })

  return `You are an AI assistant helping a service-business sales manager track client conversations.

Analyze the following ${channel} conversation between a manager and a client named "${contactName}".
The conversation may be in any language — analyze it as-is and respond in the same language as the conversation.

CONVERSATION:
${lines.join('\n')}

Evaluate:
- Where the conversation currently stands (interest level, urgency, objections)
- Risk of losing this client and specific reasons
- The manager's single most important next step
- Whether the client has already been lost or is very likely to churn (and why)
- Overall client sentiment

Return a JSON object matching the provided schema.`
}

export async function analyzeConversation(payload: GeminiAnalysisPayload): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set — cannot run AI analysis')
  }

  if (!payload.messages.length) {
    throw new Error('Cannot analyze a conversation with no messages')
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  const result = await model.generateContent(buildPrompt(payload))
  const text = result.response.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      `Gemini returned non-JSON output (first 300 chars): ${text.slice(0, 300)}`,
    )
  }

  return validateResult(parsed)
}
