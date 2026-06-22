import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { setAlertStatus, type AlertAction } from '@/services/alert.service'

const VALID_ACTIONS = new Set<AlertAction>(['acknowledge', 'resolve', 'reopen', 'snooze'])

/**
 * Transition an alert's status (ownership-checked).
 *   PATCH /api/alerts/:id  { "action": "acknowledge" | "resolve" | "reopen" | "snooze", "snoozeDays"?: number }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action as AlertAction | undefined
  if (!action || !VALID_ACTIONS.has(action)) {
    return err('Invalid action — expected acknowledge | resolve | reopen | snooze', 400)
  }

  const rawDays = typeof body?.snoozeDays === 'number' ? body.snoozeDays : undefined
  const snoozeDays = rawDays && rawDays > 0 ? Math.min(30, Math.round(rawDays)) : undefined

  const updated = await setAlertStatus(ctx.organization.id, id, action, { snoozeDays })
  if (!updated) return err('Alert not found', 404)
  return ok(updated)
}
