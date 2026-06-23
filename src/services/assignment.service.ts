/**
 * Shared-inbox collaboration: assignment, queue state, internal notes and tags.
 * Every mutation is org-scoped (verified against the conversation's org) and
 * writes an AuditLog entry. Internal notes are team-only and never sent to the
 * contact.
 */
import type { ConversationState } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/services/audit.service'

export class CollabError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'CollabError'
  }
}

/** Verify a conversation belongs to the org; returns its subject for audit text. */
async function requireConv(organizationId: string, conversationId: string) {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { id: true, subject: true, assigneeId: true, state: true },
  })
  if (!conv) throw new CollabError('Conversation not found', 404)
  return conv
}

// ── Assignment ───────────────────────────────────────────────────────────────

export interface AssignResult {
  assigneeId: string | null
  assigneeName: string | null
}

/** Assign (or clear, with null) a conversation to a membership in the same org. */
export async function assignConversation(
  organizationId: string,
  actorId: string,
  conversationId: string,
  membershipId: string | null,
): Promise<AssignResult> {
  const conv = await requireConv(organizationId, conversationId)

  let assigneeName: string | null = null
  if (membershipId) {
    const m = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId, status: 'ACTIVE' },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!m) throw new CollabError('Assignee is not a member of this organization', 400)
    assigneeName = m.user.name ?? m.user.email
  }

  await prisma.conversation.update({ where: { id: conv.id }, data: { assigneeId: membershipId } })
  await recordAudit({
    organizationId,
    actorId,
    action: membershipId ? 'conversation.assigned' : 'conversation.unassigned',
    summary: membershipId
      ? `Assigned “${conv.subject ?? 'conversation'}” to ${assigneeName}`
      : `Unassigned “${conv.subject ?? 'conversation'}”`,
    targetType: 'conversation',
    targetId: conv.id,
  })
  return { assigneeId: membershipId, assigneeName }
}

// ── Queue state ──────────────────────────────────────────────────────────────

const STATE_VERB: Record<ConversationState, string> = {
  OPEN: 'Reopened',
  SNOOZED: 'Snoozed',
  CLOSED: 'Closed',
}

export async function setConversationState(
  organizationId: string,
  actorId: string,
  conversationId: string,
  state: ConversationState,
): Promise<{ state: ConversationState }> {
  const conv = await requireConv(organizationId, conversationId)
  await prisma.conversation.update({ where: { id: conv.id }, data: { state } })
  await recordAudit({
    organizationId,
    actorId,
    action: 'conversation.state',
    summary: `${STATE_VERB[state]} “${conv.subject ?? 'conversation'}”`,
    targetType: 'conversation',
    targetId: conv.id,
    metadata: { state },
  })
  return { state }
}

// ── Internal notes ───────────────────────────────────────────────────────────

export interface InternalNoteItem {
  id: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
}

export async function addInternalNote(
  organizationId: string,
  actorId: string,
  conversationId: string,
  body: string,
): Promise<InternalNoteItem> {
  const conv = await requireConv(organizationId, conversationId)
  const trimmed = body.trim().slice(0, 4000)
  if (!trimmed) throw new CollabError('Note is empty', 400)

  const note = await prisma.internalNote.create({
    data: { organizationId, conversationId: conv.id, authorId: actorId, body: trimmed },
  })
  const author = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } })
  await recordAudit({
    organizationId,
    actorId,
    action: 'conversation.note',
    summary: `Added an internal note on “${conv.subject ?? 'conversation'}”`,
    targetType: 'conversation',
    targetId: conv.id,
  })
  return {
    id: note.id,
    body: note.body,
    authorId: actorId,
    authorName: author?.name ?? author?.email ?? 'Unknown',
    createdAt: note.createdAt.toISOString(),
  }
}

export async function listInternalNotes(organizationId: string, conversationId: string): Promise<InternalNoteItem[]> {
  const notes = await prisma.internalNote.findMany({
    where: { organizationId, conversationId },
    orderBy: { createdAt: 'asc' },
  })
  if (!notes.length) return []
  const authorIds = [...new Set(notes.map((n) => n.authorId))]
  const users = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
  const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email]))
  return notes.map((n) => ({
    id: n.id,
    body: n.body,
    authorId: n.authorId,
    authorName: nameById.get(n.authorId) ?? 'Unknown',
    createdAt: n.createdAt.toISOString(),
  }))
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface TagItem {
  id: string
  name: string
  color: string
}

export async function listOrgTags(organizationId: string): Promise<TagItem[]> {
  const tags = await prisma.tag.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
  return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))
}

export async function createTag(
  organizationId: string,
  actorId: string,
  name: string,
  color?: string,
): Promise<TagItem> {
  const clean = name.trim().slice(0, 40)
  if (!clean) throw new CollabError('Tag name is required', 400)
  const tag = await prisma.tag.upsert({
    where: { organizationId_name: { organizationId, name: clean } },
    create: { organizationId, name: clean, color: color?.trim() || '#6366F1' },
    update: {},
  })
  await recordAudit({
    organizationId,
    actorId,
    action: 'tag.created',
    summary: `Created tag “${clean}”`,
    targetType: 'tag',
    targetId: tag.id,
  })
  return { id: tag.id, name: tag.name, color: tag.color }
}

/** Add/remove a tag on a conversation (both org-scoped). */
export async function setConversationTag(
  organizationId: string,
  actorId: string,
  conversationId: string,
  tagId: string,
  attached: boolean,
): Promise<void> {
  const conv = await requireConv(organizationId, conversationId)
  const tag = await prisma.tag.findFirst({ where: { id: tagId, organizationId }, select: { id: true, name: true } })
  if (!tag) throw new CollabError('Tag not found', 404)

  if (attached) {
    await prisma.conversationTag.upsert({
      where: { conversationId_tagId: { conversationId: conv.id, tagId } },
      create: { conversationId: conv.id, tagId },
      update: {},
    })
  } else {
    await prisma.conversationTag.deleteMany({ where: { conversationId: conv.id, tagId } })
  }
  await recordAudit({
    organizationId,
    actorId,
    action: attached ? 'conversation.tagged' : 'conversation.untagged',
    summary: `${attached ? 'Tagged' : 'Untagged'} “${conv.subject ?? 'conversation'}” ${attached ? 'with' : '·'} ${tag.name}`,
    targetType: 'conversation',
    targetId: conv.id,
  })
}

/** Tags currently attached to a conversation. */
export async function listConversationTags(organizationId: string, conversationId: string): Promise<TagItem[]> {
  const rows = await prisma.conversationTag.findMany({
    where: { conversationId, tag: { organizationId } },
    include: { tag: true },
  })
  return rows.map((r) => ({ id: r.tag.id, name: r.tag.name, color: r.tag.color }))
}
