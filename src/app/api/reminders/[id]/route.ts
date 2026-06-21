import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { setReminderStatus } from '@/services/reminder.service'

/**
 * Mark a reminder done or cancel it (ownership-checked).
 *   PATCH /api/reminders/:id  { "action": "done" | "cancel" }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = (body as { action?: unknown })?.action
  const status = action === 'done' ? 'DONE' : action === 'cancel' ? 'CANCELLED' : null
  if (!status) return err('Invalid action — expected done | cancel', 400)

  const updated = await setReminderStatus(user.id, id, status)
  if (!updated) return err('Reminder not found', 404)
  return ok({ id: updated.id, status: updated.status })
}
