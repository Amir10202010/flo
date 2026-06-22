import type { Reminder } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Follow-up reminders ("remind me to message X on Friday"), created by the
 * assistant's create_reminder action. A reminder fires exactly once — `firedAt`
 * is the guard — surfacing in the proactive notification email when it comes
 * due. Nothing here sends mail; the notification service consumes dueReminders.
 *
 * Org-scoped: reminders belong to the organization (the team sees them on the
 * shared dashboard), while `authorId` records the member who set it.
 */

const MAX_LIST = 50

export interface CreateReminderInput {
  note: string
  dueAt: Date
  conversationId?: string | null
  contactName?: string | null
}

export async function createReminder(
  organizationId: string,
  authorId: string,
  input: CreateReminderInput,
): Promise<Reminder> {
  return prisma.reminder.create({
    data: {
      organizationId,
      userId: authorId,
      note: input.note.slice(0, 500),
      dueAt: input.dueAt,
      conversationId: input.conversationId ?? null,
      contactName: input.contactName ?? null,
    },
  })
}

/** Pending reminders, soonest first — used by the assistant briefing + UI. */
export async function listReminders(organizationId: string, limit = MAX_LIST): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { organizationId, status: 'PENDING' },
    orderBy: { dueAt: 'asc' },
    take: limit,
  })
}

/** Reminders that have come due and have not yet been surfaced. */
export async function dueReminders(organizationId: string, now: Date = new Date()): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { organizationId, status: 'PENDING', firedAt: null, dueAt: { lte: now } },
    orderBy: { dueAt: 'asc' },
  })
}

/** Mark reminders as surfaced so they never fire twice. */
export async function markRemindersFired(ids: string[], now: Date = new Date()): Promise<void> {
  if (!ids.length) return
  await prisma.reminder.updateMany({ where: { id: { in: ids } }, data: { firedAt: now } })
}

/** Org-scoped lifecycle transitions. Returns null when the reminder isn't the org's. */
export async function setReminderStatus(
  organizationId: string,
  reminderId: string,
  status: 'DONE' | 'CANCELLED',
): Promise<Reminder | null> {
  const reminder = await prisma.reminder.findFirst({ where: { id: reminderId, organizationId } })
  if (!reminder) return null
  return prisma.reminder.update({ where: { id: reminder.id }, data: { status } })
}
