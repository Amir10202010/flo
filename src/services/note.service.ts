import type { ContactNote } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Free-text notes about a contact. Created by the assistant's create_note
 * action (after the user confirms the proposed note) or manually on /clients,
 * and recalled in the assistant briefing. Org-scoped (the team shares contact
 * notes); `authorId` records who wrote each one.
 */

export interface CreateNoteInput {
  contactId: string
  body: string
  source?: 'assistant' | 'manual'
}

export interface RecentNote {
  id: string
  body: string
  createdAt: Date
  contactId: string
  contactName: string
}

/** Create a note, but only if the contact belongs to the org. Returns null otherwise. */
export async function createContactNote(
  organizationId: string,
  authorId: string,
  input: CreateNoteInput,
): Promise<ContactNote | null> {
  const contact = await prisma.contact.findFirst({ where: { id: input.contactId, organizationId } })
  if (!contact) return null
  return prisma.contactNote.create({
    data: {
      organizationId,
      userId: authorId,
      contactId: input.contactId,
      body: input.body.trim().slice(0, 2000),
      source: input.source ?? 'assistant',
    },
  })
}

/** Notes for one contact, newest first (org-scoped). */
export async function listContactNotes(organizationId: string, contactId: string, limit = 50): Promise<ContactNote[]> {
  return prisma.contactNote.findMany({
    where: { organizationId, contactId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Most recent notes across all contacts — fuels the assistant briefing recall. */
export async function listRecentNotes(organizationId: string, limit = 12): Promise<RecentNote[]> {
  const rows = await prisma.contactNote.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { contact: { select: { name: true } } },
  })
  return rows.map((n) => ({
    id: n.id,
    body: n.body,
    createdAt: n.createdAt,
    contactId: n.contactId,
    contactName: n.contact.name,
  }))
}

/** Delete a note if it belongs to the org. Returns true when a row was removed. */
export async function deleteContactNote(organizationId: string, noteId: string): Promise<boolean> {
  const res = await prisma.contactNote.deleteMany({ where: { id: noteId, organizationId } })
  return res.count > 0
}
