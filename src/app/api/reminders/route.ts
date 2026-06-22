import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { listReminders } from '@/services/reminder.service'
import { shortDate } from '@/lib/time'

/**
 * List the user's pending reminders for the dashboard widget.
 *   GET /api/reminders → { reminders: [{ id, note, dueLabel, overdue, href }] }
 * Due labels are formatted server-side (no client Date() → no hydration drift).
 */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const rows = await listReminders(ctx.organization.id)
  const now = Date.now()

  return ok({
    reminders: rows.map((r) => ({
      id: r.id,
      note: r.note,
      dueLabel: shortDate(r.dueAt),
      overdue: r.dueAt.getTime() <= now,
      href: r.conversationId ? `/inbox/${r.conversationId}` : null,
      contactName: r.contactName,
    })),
  })
}
