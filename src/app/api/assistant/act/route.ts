import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { coerceAction, executeAction } from '@/services/assistant.actions'

/**
 * Execute an assistant-proposed action AFTER the user confirms it.
 *
 *   POST /api/assistant/act  { "action": { type, ...params } }
 *
 * The action is re-validated server-side (coerceAction) and run through
 * userId-scoped services — the assistant only ever proposed it. Nothing here
 * sends email; the only effects are queueing review-before-send drafts,
 * flipping an alert's status, or creating a reminder.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'assistantAct')
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const action = coerceAction((body as { action?: unknown })?.action)
  if (!action) return err('Invalid or unsupported action', 400)

  try {
    const result = await executeAction(user.id, action)
    return ok(result)
  } catch (e) {
    console.error('[api/assistant/act] failed:', e)
    return err('Could not complete that action — please try again', 500)
  }
}
