import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { setAlertStatus, type AlertAction } from '@/services/alert.service'

const VALID_ACTIONS = new Set<AlertAction>(['acknowledge', 'resolve', 'reopen', 'snooze'])

/**
 * Transition an alert's status (ownership-checked).
 *   PATCH /api/alerts/:id  { "action": "acknowledge" | "resolve" | "reopen" | "snooze", "snoozeDays"?: number }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action as AlertAction | undefined
  if (!action || !VALID_ACTIONS.has(action)) {
    return err('Invalid action — expected acknowledge | resolve | reopen | snooze', 400)
  }

  const rawDays = typeof body?.snoozeDays === 'number' ? body.snoozeDays : undefined
  const snoozeDays = rawDays && rawDays > 0 ? Math.min(30, Math.round(rawDays)) : undefined

  const updated = await setAlertStatus(user.id, id, action, { snoozeDays })
  if (!updated) return err('Alert not found', 404)
  return ok(updated)
}
