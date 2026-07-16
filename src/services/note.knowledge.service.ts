import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { timeAgo } from '@/lib/time'
import { getTextProvider, embedTexts } from './ai'
import { extractNoteKnowledge } from './ai/knowledge'
import { resolveMentionedContacts, writeExtractedKnowledge } from './knowledge.extract'
import { contactNode, noteNode, outgoingChips, type NodeChip } from './graph.service'
import { vectorToBuffer } from './embedding.service'
import { enqueueExtractNoteKnowledge } from './jobs/queue'

/**
 * Knowledge notes — plain text the user writes; AI links each note to people,
 * companies and topics on save (MENTIONS edges from `note:<id>`), extracts
 * facts, and embeds the text for semantic search.
 *
 * Linking uses REPLACE semantics (a note is a mutable document): each pass
 * deletes the note's previous edges + facts and rewrites from the latest body.
 * The PATCH route only enqueues a link pass when the content actually changed,
 * so identical saves never re-run extraction.
 */

// ── Read shapes ──────────────────────────────────────────────────────────────

export interface NoteListItem {
  id: string
  title: string
  excerpt: string
  updatedAtIso: string
  updatedAgo: string
  linked: NodeChip[]
  /** true while an auto-link pass is pending for the latest content. */
  pendingLink: boolean
}

export interface NoteDetail {
  id: string
  title: string
  body: string
  updatedAtIso: string
  linked: NodeChip[]
  pendingLink: boolean
}

function excerptOf(body: string, max = 140): string {
  const clean = body.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/** A note with a non-trivial body shows "linking…" until the pass lands. */
function isPendingLink(note: { body: string; linkedAt: Date | null }): boolean {
  return note.linkedAt === null && note.body.trim().length >= MIN_LINK_BODY
}

const MIN_LINK_BODY = 12

// ── Linked-entity chip resolution (batched) ──────────────────────────────────

/** Chips for many notes at once, keyed by note id (shared graph resolver). */
async function linkedChipsByNote(userId: string, noteIds: string[]): Promise<Map<string, NodeChip[]>> {
  const byRef = await outgoingChips(userId, noteIds.map(noteNode))
  const out = new Map<string, NodeChip[]>()
  for (const [ref, chips] of byRef) out.set(ref.slice('note:'.length), chips)
  return out
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listNotes(userId: string, limit = 100): Promise<NoteListItem[]> {
  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true, title: true, body: true, updatedAt: true, linkedAt: true },
  })
  const chips = await linkedChipsByNote(userId, notes.map((n) => n.id))
  const now = Date.now()
  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    excerpt: excerptOf(n.body),
    updatedAtIso: n.updatedAt.toISOString(),
    updatedAgo: timeAgo(n.updatedAt, now) ?? 'just now',
    linked: chips.get(n.id) ?? [],
    pendingLink: isPendingLink(n),
  }))
}

export async function getNoteDetail(userId: string, noteId: string): Promise<NoteDetail | null> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true, title: true, body: true, updatedAt: true, linkedAt: true },
  })
  if (!note) return null
  const chips = await linkedChipsByNote(userId, [note.id])
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    updatedAtIso: note.updatedAt.toISOString(),
    linked: chips.get(note.id) ?? [],
    pendingLink: isPendingLink(note),
  }
}

export interface NoteOwner {
  userId: string
  organizationId: string | null
}

export async function createNote(owner: NoteOwner, input: { title?: string; body?: string }): Promise<{ id: string }> {
  const title = (input.title ?? '').trim().slice(0, 200)
  const body = (input.body ?? '').slice(0, 20_000)
  const note = await prisma.note.create({
    data: { userId: owner.userId, organizationId: owner.organizationId, title, body },
    select: { id: true },
  })
  if (body.trim().length >= MIN_LINK_BODY) await enqueueExtractNoteKnowledge(note.id)
  return note
}

/**
 * Update a note (autosave). Enqueues a re-link pass only when the content
 * actually changed — identical saves never re-run extraction.
 */
export async function updateNote(
  userId: string,
  noteId: string,
  patch: { title?: string; body?: string },
): Promise<{ id: string; pendingLink: boolean } | null> {
  const existing = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true, title: true, body: true, linkedAt: true },
  })
  if (!existing) return null

  const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) : existing.title
  const body = patch.body !== undefined ? patch.body.slice(0, 20_000) : existing.body
  const changed = title !== existing.title || body !== existing.body

  const relink = changed && body.trim().length >= MIN_LINK_BODY
  const updated = await prisma.note.update({
    where: { id: existing.id },
    data: { title, body, ...(relink ? { linkedAt: null } : {}) },
    select: { id: true, body: true, linkedAt: true },
  })
  if (relink) await enqueueExtractNoteKnowledge(existing.id)
  return { id: updated.id, pendingLink: isPendingLink(updated) }
}

/** Delete a note and every trace it left: edges, facts, embedding. */
export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId }, select: { id: true } })
  if (!note) return false
  const ref = noteNode(note.id)
  await prisma.graphEdge.deleteMany({ where: { userId, OR: [{ fromNode: ref }, { toNode: ref }] } })
  await prisma.knowledgeFact.deleteMany({ where: { userId, sourceType: 'note', sourceId: note.id } })
  await prisma.knowledgeEmbedding.deleteMany({ where: { sourceType: 'note', sourceId: note.id } })
  await prisma.note.delete({ where: { id: note.id } })
  return true
}

// ── Auto-linking (EXTRACT_NOTE_KNOWLEDGE job) ───────────────────────────────

export interface LinkNoteResult {
  linked: number
  facts: number
  skipped?: 'missing' | 'too-short' | 'no-ai-provider'
}

export async function linkNoteKnowledge(
  noteId: string,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<LinkNoteResult> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, userId: true, organizationId: true, title: true, body: true, updatedAt: true },
  })
  // Deleted between enqueue and run — nothing to do (never fail the job).
  if (!note) return { linked: 0, facts: 0, skipped: 'missing' }

  const ref = noteNode(note.id)
  const markLinked = () => prisma.note.update({ where: { id: note.id }, data: { linkedAt: new Date() } })

  if (note.body.trim().length < MIN_LINK_BODY) {
    await prisma.graphEdge.deleteMany({ where: { userId: note.userId, fromNode: ref } })
    await prisma.knowledgeFact.deleteMany({ where: { userId: note.userId, sourceType: 'note', sourceId: note.id } })
    await markLinked()
    return { linked: 0, facts: 0, skipped: 'too-short' }
  }

  if (!getTextProvider()) {
    await markLinked()
    return { linked: 0, facts: 0, skipped: 'no-ai-provider' }
  }

  // Contacts the model may report as mentioned (most recently added first).
  const contacts = await prisma.contact.findMany({
    where: { userId: note.userId },
    orderBy: { createdAt: 'desc' },
    take: 150,
    select: { id: true, name: true, email: true },
  })
  const existingTopics = await prisma.graphEntity.findMany({
    where: { userId: note.userId, type: 'TOPIC' },
    orderBy: { weight: 'desc' },
    take: 30,
    select: { name: true, canonicalKey: true },
  })

  const knowledge = await extractNoteKnowledge(
    {
      title: note.title,
      body: note.body,
      existingTopics,
      contactNames: contacts.map((c) => c.name).filter(Boolean),
    },
    opts,
  )
  const mentionedContactIds = resolveMentionedContacts(knowledge.mentionedContacts, contacts)

  // REPLACE: a note is a mutable document — clear its previous links + facts,
  // then rewrite from the latest body.
  await prisma.graphEdge.deleteMany({ where: { userId: note.userId, fromNode: ref } })
  await prisma.knowledgeFact.deleteMany({ where: { userId: note.userId, sourceType: 'note', sourceId: note.id } })

  const result = await writeExtractedKnowledge(
    { userId: note.userId, organizationId: note.organizationId },
    { type: 'note', id: note.id, happenedAt: note.updatedAt },
    { ...knowledge, mentionedContactIds },
    {
      topicFrom: [ref],
      mentionFrom: ref,
      aboutNode: mentionedContactIds[0] ? contactNode(mentionedContactIds[0]) : null,
    },
  )

  await embedNote(note.id, note.title, note.body)
  await markLinked()

  return { linked: result.edges, facts: result.facts }
}

/** Embed the note for semantic search — best-effort, hash-deduped, non-fatal. */
async function embedNote(noteId: string, title: string, body: string): Promise<void> {
  try {
    const text = `${title}\n${body}`.slice(0, 6000)
    const contentHash = crypto.createHash('sha256').update(text).digest('hex')
    const existing = await prisma.knowledgeEmbedding.findUnique({
      where: { sourceType_sourceId: { sourceType: 'note', sourceId: noteId } },
      select: { contentHash: true },
    })
    if (existing?.contentHash === contentHash) return

    const embedded = await embedTexts([text], 'document')
    if (!embedded) return
    await prisma.knowledgeEmbedding.upsert({
      where: { sourceType_sourceId: { sourceType: 'note', sourceId: noteId } },
      create: {
        sourceType: 'note',
        sourceId: noteId,
        model: embedded.model,
        dims: embedded.dims,
        vector: vectorToBuffer(embedded.vectors[0]),
        contentHash,
      },
      update: {
        model: embedded.model,
        dims: embedded.dims,
        vector: vectorToBuffer(embedded.vectors[0]),
        contentHash,
      },
    })
  } catch (err) {
    console.warn('[notes] embedding failed (non-fatal):', String(err))
  }
}
