import { type NextRequest } from 'next/server'
import type { ConversationState } from '@prisma/client'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { setConversationState, CollabError } from '@/services/assignment.service'

const VALID = new Set<ConversationState>(['OPEN', 'SNOOZED', 'CLOSED'])

/**
 * Move a conversation through the shared-inbox queue.
 *   POST /api/conversations/:id/state  { state: "OPEN" | "SNOOZED" | "CLOSED" }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const state = (body as { state?: unknown })?.state as ConversationState | undefined
  if (!state || !VALID.has(state)) return err('Invalid state — expected OPEN | SNOOZED | CLOSED', 400)

  try {
    const result = await setConversationState(ctx.organization.id, ctx.userId, id, state)
    return ok(result)
  } catch (e) {
    if (e instanceof CollabError) return err(e.message, e.status)
    console.error('[state] failed:', e)
    return err('Could not update the conversation state', 500)
  }
}
