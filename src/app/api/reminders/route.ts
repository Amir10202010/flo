import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { createReminder, listReminders } from '@/services/reminder.service'
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

/**
 * Create a follow-up reminder directly (the meeting debrief's one-click
 * "Remind me" on an action item; the assistant path stays propose→confirm).
 *   POST /api/reminders  { "note": string, "dueAt"?: ISO, "contactName"?: string }
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = (await req.json().catch(() => null)) as
    | { note?: unknown; dueAt?: unknown; contactName?: unknown }
    | null
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (note.length < 3) return err('A reminder needs a note', 400)

  const parsed = typeof body?.dueAt === 'string' ? new Date(body.dueAt) : null
  // Default: tomorrow at this time — a sane follow-up window.
  const dueAt = parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()
    ? parsed
    : new Date(Date.now() + 24 * 60 * 60_000)

  const reminder = await createReminder(ctx.organization.id, ctx.userId, {
    note,
    dueAt,
    contactName: typeof body?.contactName === 'string' ? body.contactName.slice(0, 120) : null,
  })
  return ok({ id: reminder.id, dueLabel: shortDate(reminder.dueAt) }, 201)
}
