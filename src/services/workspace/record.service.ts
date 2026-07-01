/**
 * CRUD over workspace records (rows of workspace-defined objects). Every entry
 * point is organizationId-scoped and validates `data` against the object's
 * FieldDefinitions through the field-type registry — nothing unvalidated
 * reaches CrmRecord.data. Sequential Prisma calls only (small pool).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateRecordData } from '@/lib/workspace/field-types'
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
