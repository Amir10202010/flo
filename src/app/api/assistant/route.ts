import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { answerWorkspaceQuestion } from '@/services/assistant.service'

/**
 * Workspace Q&A assistant.
 *
 *   POST /api/assistant  { "question": "Who should I follow up with today?" }
 *
 * Answers are grounded in the user's real workspace (dashboard read-model) and
 * degrade to a deterministic local answer when no AI provider is configured.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const question = typeof (body as { question?: unknown })?.question === 'string'
    ? (body as { question: string }).question.trim()
    : ''

  if (!question) return err('A question is required', 400)
  if (question.length > 500) return err('Question is too long (max 500 characters)', 400)

  try {
    const result = await answerWorkspaceQuestion(user.id, question)
    return ok(result)
  } catch (e) {
    console.error('[api/assistant] failed:', e)
    return err('The assistant could not answer right now — please try again', 500)
  }
}
