import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { orgHasFeature } from '@/services/billing.service'
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
  // Assistant actions mutate the workspace → require write access.
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'assistantAct')
  if (limited) return limited

  if (!(await orgHasFeature(ctx.organization.id, 'assistant'))) {
    return err('Upgrade to Pro to use the AI assistant', 402)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const action = coerceAction((body as { action?: unknown })?.action)
  if (!action) return err('Invalid or unsupported action', 400)

  try {
    const result = await executeAction(ctx.organization.id, ctx.userId, action)
    return ok(result)
  } catch (e) {
    console.error('[api/assistant/act] failed:', e)
    return err('Could not complete that action — please try again', 500)
  }
}
