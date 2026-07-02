/**
 * CRUD over workspace records (rows of workspace-defined objects). Every entry
 * point is organizationId-scoped and validates `data` against the object's
 * FieldDefinitions through the field-type registry — nothing unvalidated
 * reaches CrmRecord.data. Sequential Prisma calls only (small pool).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateRecordData } from '@/lib/workspace/field-types'
import { StoredStagesSchema } from '@/lib/workspace/blueprint'
import { compactAgo } from '@/lib/time'
import { getObjectById, getObjectByKey, type WorkspaceObjectModel } from './workspace.service'

export interface RecordModel {
  id: string
  title: string
  stageKey: string | null
  data: Record<string, unknown>
  createdAt: string
  /** Pre-formatted server-side (client components must not format times). */
  updatedAgo: string
}

export type RecordWriteResult =
  | { ok: true; record: RecordModel }
  | { ok: false; errors: string[] }

function toModel(row: {
  id: string
  title: string
  stageKey: string | null
  data: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}): RecordModel {
  return {
    id: row.id,
    title: row.title,
    stageKey: row.stageKey,
    data: (row.data ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAgo: compactAgo(row.updatedAt),
  }
}

function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().slice(0, 200)
  return t.length ? t : null
}

function stageKeys(object: WorkspaceObjectModel): Set<string> {
  return new Set((object.pipeline ?? []).map((s) => s.key))
}

export interface ListRecordsResult {
  object: WorkspaceObjectModel
  records: RecordModel[]
}

/** Records of one object, newest-updated first. Null = unknown object key. */
export async function listRecords(
  organizationId: string,
  objectKey: string,
  opts: { q?: string; stageKey?: string; limit?: number } = {},
): Promise<ListRecordsResult | null> {
  const object = await getObjectByKey(organizationId, objectKey)
  if (!object) return null

  const rows = await prisma.crmRecord.findMany({
    where: {
      organizationId,
      objectId: object.id,
      ...(opts.stageKey ? { stageKey: opts.stageKey } : {}),
      ...(opts.q ? { title: { contains: opts.q.slice(0, 100), mode: 'insensitive' } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(opts.limit ?? 200, 1), 500),
  })
  return { object, records: rows.map(toModel) }
}

/** Create a record. Null = unknown object key. */
export async function createRecord(
  organizationId: string,
  objectKey: string,
  input: { title?: unknown; stageKey?: unknown; data?: unknown },
  actor: { userId: string; membershipId: string },
): Promise<RecordWriteResult | null> {
  const object = await getObjectByKey(organizationId, objectKey)
  if (!object) return null

  const title = cleanTitle(input.title)
  if (!title) return { ok: false, errors: ['Title is required'] }

  const validStages = stageKeys(object)
  let stageKey: string | null = null
  if (object.pipeline?.length) {
    if (input.stageKey !== undefined && input.stageKey !== null && input.stageKey !== '') {
      if (typeof input.stageKey !== 'string' || !validStages.has(input.stageKey)) {
        return { ok: false, errors: ['Unknown stage'] }
      }
      stageKey = input.stageKey
    } else {
      stageKey = object.pipeline[0].key
    }
  }

  const validated = validateRecordData(object.fields, input.data)
  if (!validated.ok) return { ok: false, errors: validated.errors }

  const row = await prisma.crmRecord.create({
    data: {
      organizationId,
      objectId: object.id,
      title,
      stageKey,
      data: validated.data as Prisma.InputJsonValue,
      createdById: actor.userId,
      ownerMembershipId: actor.membershipId,
    },
  })
  return { ok: true, record: toModel(row) }
}

/**
 * Update title/stage/data (all optional; `data` is a partial merge — explicit
 * nulls clear a field). Null = record not found in this org.
 */
export async function updateRecord(
  organizationId: string,
  recordId: string,
  patch: { title?: unknown; stageKey?: unknown; data?: unknown },
): Promise<RecordWriteResult | null> {
  const existing = await prisma.crmRecord.findFirst({ where: { id: recordId, organizationId } })
  if (!existing) return null
  const object = await getObjectById(organizationId, existing.objectId)
  if (!object) return null

  const update: Prisma.CrmRecordUpdateInput = {}

  if (patch.title !== undefined) {
    const title = cleanTitle(patch.title)
    if (!title) return { ok: false, errors: ['Title is required'] }
    update.title = title
  }

  if (patch.stageKey !== undefined) {
    if (patch.stageKey === null || patch.stageKey === '') {
      update.stageKey = null
    } else if (typeof patch.stageKey === 'string' && stageKeys(object).has(patch.stageKey)) {
      update.stageKey = patch.stageKey
    } else {
      return { ok: false, errors: ['Unknown stage'] }
    }
  }

  if (patch.data !== undefined) {
    const validated = validateRecordData(object.fields, patch.data, { partial: true })
    if (!validated.ok) return { ok: false, errors: validated.errors }
    const merged: Record<string, unknown> = { ...((existing.data ?? {}) as Record<string, unknown>) }
    for (const [key, value] of Object.entries(validated.data)) {
      if (value === null) delete merged[key]
      else merged[key] = value
    }
    update.data = merged as Prisma.InputJsonValue
  }

  const row = await prisma.crmRecord.update({ where: { id: existing.id }, data: update })
  return { ok: true, record: toModel(row) }
}

/** Hard-delete one record (user-initiated). False = not found in this org. */
export async function deleteRecord(organizationId: string, recordId: string): Promise<boolean> {
  const res = await prisma.crmRecord.deleteMany({ where: { id: recordId, organizationId } })
  return res.count > 0
}

// ── Record ↔ conversation linking (the inbox ↔ CRM-objects bridge) ──────────

export interface LinkedRecord {
  linkId: string | null
  recordId: string
  title: string
  objectKey: string
  objectSingular: string
  icon: string
  stageLabel: string | null
}

type RecordWithObject = {
  id: string
  title: string
  stageKey: string | null
  object: { key: string; singular: string; icon: string; pipeline: Prisma.JsonValue | null }
}

function toLinkedRecord(linkId: string | null, r: RecordWithObject): LinkedRecord {
  const stages = StoredStagesSchema.safeParse(r.object.pipeline)
  const stageLabel = r.stageKey
    ? (stages.success ? stages.data.find((s) => s.key === r.stageKey)?.label : undefined) ?? r.stageKey
    : null
  return {
    linkId,
    recordId: r.id,
    title: r.title,
    objectKey: r.object.key,
    objectSingular: r.object.singular,
    icon: r.object.icon,
    stageLabel,
  }
}

const LINK_OBJECT_SELECT = {
  select: { key: true, singular: true, icon: true, pipeline: true },
} as const

/** Records linked to one conversation, newest link first. */
export async function listRecordsForConversation(
  organizationId: string,
  conversationId: string,
): Promise<LinkedRecord[]> {
  const links = await prisma.recordConversationLink.findMany({
    where: { organizationId, conversationId },
    include: { record: { include: { object: LINK_OBJECT_SELECT } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return links.map((l) => toLinkedRecord(l.id, l.record))
}

/**
 * Link a record to a conversation (idempotent via the unique pair). Both sides
 * are verified to belong to the org; null = either side not found.
 */
export async function linkRecordToConversation(
  organizationId: string,
  conversationId: string,
  recordId: string,
  createdById?: string,
): Promise<LinkedRecord | null> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { id: true },
  })
  if (!conv) return null
  const record = await prisma.crmRecord.findFirst({
    where: { id: recordId, organizationId },
    include: { object: LINK_OBJECT_SELECT },
  })
  if (!record) return null

  const link = await prisma.recordConversationLink.upsert({
    where: { recordId_conversationId: { recordId, conversationId } },
    create: { organizationId, recordId, conversationId, createdById: createdById ?? null },
    update: {},
  })
  return toLinkedRecord(link.id, record)
}

/** Remove one link (org-scoped). False = not found. */
export async function unlinkRecordFromConversation(
  organizationId: string,
  linkId: string,
): Promise<boolean> {
  const res = await prisma.recordConversationLink.deleteMany({ where: { id: linkId, organizationId } })
  return res.count > 0
}

/** Title search across ALL active objects — powers the thread link picker. */
export async function searchRecords(
  organizationId: string,
  q: string,
  limit = 8,
): Promise<LinkedRecord[]> {
  const query = q.trim().slice(0, 100)
  if (!query) return []
  const rows = await prisma.crmRecord.findMany({
    where: {
      organizationId,
      title: { contains: query, mode: 'insensitive' },
      object: { isArchived: false },
    },
    include: { object: LINK_OBJECT_SELECT },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 20),
  })
  return rows.map((r) => toLinkedRecord(null, r))
}

/** One record + its object model (for the detail page). Null = not in org. */
export async function getRecord(
  organizationId: string,
  objectKey: string,
  recordId: string,
): Promise<{ object: WorkspaceObjectModel; record: RecordModel } | null> {
  const object = await getObjectByKey(organizationId, objectKey)
  if (!object) return null
  const row = await prisma.crmRecord.findFirst({
    where: { id: recordId, organizationId, objectId: object.id },
  })
  return row ? { object, record: toModel(row) } : null
}

export interface LinkedConversation {
  linkId: string
  conversationId: string
  contactName: string
  subject: string | null
  lastActivityAgo: string
}

/** Conversations linked to one record — the reverse of the thread rail. */
export async function listConversationsForRecord(
  organizationId: string,
  recordId: string,
): Promise<LinkedConversation[]> {
  const links = await prisma.recordConversationLink.findMany({
    where: { organizationId, recordId },
    include: {
      conversation: {
        select: { id: true, subject: true, lastMessageAt: true, contact: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return links.map((l) => ({
    linkId: l.id,
    conversationId: l.conversation.id,
    contactName: l.conversation.contact.name,
    subject: l.conversation.subject,
    lastActivityAgo: l.conversation.lastMessageAt ? compactAgo(l.conversation.lastMessageAt) : '',
  }))
}

export interface ObjectStats {
  total: number
  createdLast7d: number
  byStage: Record<string, number>
}

/**
 * Record counts for dashboard widgets — TWO groupBy queries for the whole org
 * regardless of widget count (small pool: never per-widget queries).
 */
export async function recordStats(organizationId: string): Promise<Map<string, ObjectStats>> {
  const byStage = await prisma.crmRecord.groupBy({
    by: ['objectId', 'stageKey'],
    where: { organizationId },
    _count: { _all: true },
  })
  const recent = await prisma.crmRecord.groupBy({
    by: ['objectId'],
    where: { organizationId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    _count: { _all: true },
  })

  const map = new Map<string, ObjectStats>()
  for (const row of byStage) {
    const stats = map.get(row.objectId) ?? { total: 0, createdLast7d: 0, byStage: {} }
    stats.total += row._count._all
    if (row.stageKey) stats.byStage[row.stageKey] = (stats.byStage[row.stageKey] ?? 0) + row._count._all
    map.set(row.objectId, stats)
  }
  for (const row of recent) {
    const stats = map.get(row.objectId) ?? { total: 0, createdLast7d: 0, byStage: {} }
    stats.createdLast7d = row._count._all
    map.set(row.objectId, stats)
  }
  return map
}
