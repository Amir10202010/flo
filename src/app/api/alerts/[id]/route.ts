import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { setAlertStatus, type AlertAction } from '@/services/alert.service'

const VALID_ACTIONS = new Set<AlertAction>(['acknowledge', 'resolve', 'reopen'])

/**
 * Transition an alert's status (ownership-checked).
 *   PATCH /api/alerts/:id  { "action": "acknowledge" | "resolve" | "reopen" }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action as AlertAction | undefined
  if (!action || !VALID_ACTIONS.has(action)) {
    return err('Invalid action — expected acknowledge | resolve | reopen', 400)
  }

  const updated = await setAlertStatus(user.id, id, action)
  if (!updated) return err('Alert not found', 404)
  return ok(updated)
}
