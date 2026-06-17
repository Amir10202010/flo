import type { AnalysisResult, DraftPayload, GeminiAnalysisPayload, RiskLevel, Sentiment, ThreadSummary } from '@/types'

/**
 * Local heuristic fallback — keeps AI features functional with NO API key and
 * $0 cost. Deterministic keyword/recency rules approximate the Gemini analysis
 * shape; results are tagged provider:'local' so the UI can label them honestly
 * ("quick scan"). Covers English + Russian vocabularies since threads may be
 * in either language.
 */

const NEGATIVE_WORDS = [
  // en
  'disappointed', 'frustrated', 'unacceptable', 'terrible', 'awful', 'angry', 'complaint',
  'refund', 'cancel', 'cancellation', 'not working', 'broken', 'issue', 'problem', 'delay',
  'still waiting', 'no response', 'lawyer', 'dispute', 'unsubscribe', 'competitor',
  // ru
  'разочарован', 'недоволен', 'возмущ', 'ужасн', 'отврат', 'жалоб', 'возврат', 'отмен',
  'не работает', 'сломан', 'проблем', 'задержк', 'до сих пор жду', 'нет ответа', 'юрист',
  'расторг', 'конкурент',
]

const CRITICAL_WORDS = [
  'refund', 'cancel my', 'cancellation', 'lawyer', 'legal action', 'chargeback', 'last warning',
  'возврат денег', 'расторгнуть', 'расторжение', 'юрист', 'суд', 'последнее предупреждение',
  'отменить заказ', 'отказываюсь',
]

const POSITIVE_WORDS = [
  'thank', 'thanks', 'great', 'perfect', 'awesome', 'love', 'appreciate', 'excellent',
  'looking forward', 'deal', 'agreed', 'sounds good', 'happy',
  'спасибо', 'благодар', 'отлично', 'супер', 'прекрасно', 'договорились', 'устраивает', 'рад',
]

function countHits(text: string, words: string[]): number {
  let hits = 0
  for (const w of words) if (text.includes(w)) hits++
  return hits
}

export function localAnalyzeConversation(payload: GeminiAnalysisPayload): AnalysisResult {
  const { contactName, messages } = payload
  const now = Date.now()

  const last = messages[messages.length - 1]
  const lastIsInbound = last?.direction === 'INBOUND'
  const hoursSinceLast = last ? (now - new Date(last.sentAt).getTime()) / 3_600_000 : Infinity

  // Sentiment from the client's recent messages only — the manager's tone
  // shouldn't color the client's sentiment.
  const inboundText = messages
    .filter((m) => m.direction === 'INBOUND')
    .slice(-5)
    .map((m) => m.content.toLowerCase())
    .join('\n')

  const negative = countHits(inboundText, NEGATIVE_WORDS)
  const critical = countHits(inboundText, CRITICAL_WORDS)
  const positive = countHits(inboundText, POSITIVE_WORDS)

  let sentiment: Sentiment = 'NEUTRAL'
  if (negative + critical * 2 > positive && negative + critical > 0) sentiment = 'NEGATIVE'
  else if (positive > 0 && positive >= negative) sentiment = 'POSITIVE'

  const riskReasons: string[] = []
  let riskLevel: RiskLevel = 'LOW'

  if (critical > 0) {
    riskLevel = 'CRITICAL'
    riskReasons.push('Client used cancellation/refund language')
  } else if (negative >= 2) {
    riskLevel = 'HIGH'
    riskReasons.push('Repeated negative signals in client messages')
  } else if (negative === 1) {
    riskLevel = 'MEDIUM'
    riskReasons.push('Negative signal detected in client messages')
  }

  if (lastIsInbound && hoursSinceLast >= 48) {
    if (riskLevel === 'LOW') riskLevel = 'MEDIUM'
    else if (riskLevel === 'MEDIUM') riskLevel = 'HIGH'
    riskReasons.push(`Client has been waiting ${Math.floor(hoursSinceLast / 24)}+ days for a reply`)
  }

  const waitNote =
    hoursSinceLast < 1 ? 'just now'
    : hoursSinceLast < 24 ? `${Math.floor(hoursSinceLast)}h ago`
    : `${Math.floor(hoursSinceLast / 24)}d ago`

  const lastSnippet = (last?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)

  const summary = lastIsInbound
    ? `${contactName} wrote ${waitNote} and is awaiting your reply${lastSnippet ? `: "${lastSnippet}"` : '.'}`
    : `You replied ${waitNote}; no response from ${contactName} yet${lastSnippet ? `. Last message: "${lastSnippet}"` : '.'}`

  const nextAction = lastIsInbound
    ? hoursSinceLast >= 24
      ? `Reply to ${contactName} now — they have been waiting ${waitNote.replace(' ago', '')}.`
      : `Reply to ${contactName}'s latest message.`
    : hoursSinceLast >= 72
      ? `Follow up with ${contactName} — your last message has gone ${Math.floor(hoursSinceLast / 24)} days unanswered.`
      : `Wait for ${contactName}'s response or add a helpful nudge.`

  return { summary, riskLevel, riskReasons, nextAction, sentiment }
}

/**
 * Zero-API reply draft — a polite, language-matched acknowledgement template.
 * Tagged provider:'local' by the caller so the UI labels it as an offline
 * template. Not as good as the AI draft, but keeps the feature usable with no key.
 */
export function localReplyDraft(p: Pick<DraftPayload, 'contactName' | 'messages'>): { body: string } {
  const text = p.messages.map((m) => m.content).join(' ')
  const ru = /[Ѐ-ӿ]/.test(text)
  const first = p.contactName?.trim().split(/\s+/)[0] ?? ''
  const body = ru
    ? `Здравствуйте${first ? `, ${first}` : ''}!\n\nСпасибо за сообщение. Я ознакомился и вернусь к вам с подробным ответом в ближайшее время.\n\nС уважением`
    : `Hi${first ? ` ${first}` : ''},\n\nThanks for your message. I've reviewed it and will get back to you shortly with a detailed reply.\n\nBest regards`
  return { body }
}

/**
 * Zero-API "catch me up" — a heuristic thread digest from the last few messages.
 * Tagged provider:'local' by the caller. Keeps the feature usable with no key.
 */
export function localThreadSummary(
  p: { contactName: string; messages: { direction: 'INBOUND' | 'OUTBOUND'; content: string }[] },
): ThreadSummary {
  const msgs = p.messages
  const last = msgs[msgs.length - 1]
  const lastInbound = last?.direction === 'INBOUND'
  const ru = /[Ѐ-ӿ]/.test(msgs.map((m) => m.content).join(' '))
  const first = p.contactName?.trim().split(/\s+/)[0] || p.contactName
  const them = first || (ru ? 'клиент' : 'them')
  const you = ru ? 'Вы' : 'You'

  const tldr = ru
    ? `Переписка с ${p.contactName}: ${msgs.length} сообщений. ${lastInbound ? 'Ждёт вашего ответа.' : 'Последнее сообщение за вами.'}`
    : `Conversation with ${p.contactName}: ${msgs.length} messages. ${lastInbound ? 'Awaiting your reply.' : 'You sent the last message.'}`

  const keyPoints = msgs.slice(-4).map((m) => {
    const who = m.direction === 'INBOUND' ? them : you
    return `${who}: ${m.content.replace(/\s+/g, ' ').trim().slice(0, 120)}`
  })

  const openItems = lastInbound ? [ru ? `Ответить ${them}.` : `Reply to ${them}.`] : []
  return { tldr, keyPoints, openItems }
}
