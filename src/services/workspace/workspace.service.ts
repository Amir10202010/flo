/**
 * Workspace materializer + schema read-model.
 *
 * `applyBlueprint` turns a validated WorkspaceBlueprint into rows — idempotent
 * upserts keyed by (organizationId, objectKey) / (objectId, fieldKey), strictly
 * sequential (tiny pooled connection limit), and NON-DESTRUCTIVE: objects and
 * fields missing from a re-applied blueprint are archived, never deleted, and
 * records are never touched.
 *
 * `getWorkspaceSchema` is the single serializable read-model the adaptive UI
 * consumes (sidebar nav, object pages, dashboard widgets, copilot persona).
 * Stored JSON is re-validated on read; corrupt data degrades to defaults.
 */
import { cache } from 'react'
import { Prisma, type WorkspaceSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/services/audit.service'
import {
  keyFromLabel,
  MAX_FIELDS_PER_OBJECT,
  StoredStagesSchema,
  StoredWidgetsSchema,
  TerminologySchema,
  BlueprintCopilotSchema,
  type BlueprintStage,
  type BlueprintWidget,
  type BlueprintCopilot,
  type WorkspaceBlueprint,
} from '@/lib/workspace/blueprint'
import { FIELD_TYPE_KEYS, type FieldSpec, type FieldTypeKey } from '@/lib/workspace/field-types'
import type { TerminologyMap } from '@/lib/workspace/terminology'
import type { OnboardingAnswers } from './blueprint.generator'

export interface WorkspaceObjectModel {
  id: string
  key: string
  singular: string
  plural: string
  icon: string
  color: string | null
  description: string | null
  pipeline: BlueprintStage[] | null
  fields: FieldSpec[]
}

export interface WorkspaceNavEntry {
  key: string
  label: string
  icon: string
  href: string
}

export interface WorkspaceSchemaModel {
  profile: {
    industryKey: string
    industryLabel: string
    subIndustry: string | null
    source: WorkspaceSource
    provider: 'gemini' | 'local' | null
  }
  terminology: TerminologyMap
  copilot: BlueprintCopilot
  /** Ordered sidebar entries for workspace objects (system entries live in the Sidebar). */
  nav: WorkspaceNavEntry[]
  objects: WorkspaceObjectModel[]
  dashboard: BlueprintWidget[]
  automationIdeas: string[]
}

// ── Row → model helpers (defensive: stored JSON is re-validated) ────────────

type FieldRow = {
  key: string
  label: string
  type: string
  config: Prisma.JsonValue
  required: boolean
  showInList: boolean
  order: number
}

function fieldRowToSpec(row: FieldRow): FieldSpec {
  const config = (row.config ?? {}) as Record<string, unknown>
  const options = Array.isArray(config.options)
    ? config.options.filter((o): o is string => typeof o === 'string')
    : undefined
  const currency = typeof config.currency === 'string' ? config.currency : undefined
  return {
    key: row.key,
    label: row.label,
    type: row.type as FieldTypeKey,
    required: row.required,
    showInList: row.showInList,
    order: row.order,
    options: options?.length ? options : undefined,
    currency,
  }
}

function parseStages(json: Prisma.JsonValue | null): BlueprintStage[] | null {
  if (!json) return null
  const parsed = StoredStagesSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

function parseTerminology(json: Prisma.JsonValue): TerminologyMap {
  const parsed = TerminologySchema.safeParse(json)
  return parsed.success ? parsed.data : {}
}

function parseCopilot(json: Prisma.JsonValue): BlueprintCopilot {
  const parsed = BlueprintCopilotSchema.safeParse(json)
  return parsed.success ? parsed.data : { title: 'Workspace copilot' }
}

function parseWidgets(json: Prisma.JsonValue, validKeys: Set<string>): BlueprintWidget[] {
  const parsed = StoredWidgetsSchema.safeParse(json)
  if (!parsed.success) return []
  return parsed.data.filter((w) => validKeys.has(w.objectKey))
}

function parseIdeas(json: Prisma.JsonValue): string[] {
  return Array.isArray(json) ? json.filter((i): i is string => typeof i === 'string').slice(0, 8) : []
}

// ── Materializer ─────────────────────────────────────────────────────────────

export interface ApplyBlueprintMeta {
  source: WorkspaceSource
  provider?: 'gemini' | 'local'
  answers?: OnboardingAnswers
  actorId?: string
}

/**
 * Materialize a VALIDATED blueprint for an organization. Callers must have run
 * the blueprint through `safeParseBlueprint` (API routes re-parse client input).
 */
export async function applyBlueprint(
  organizationId: string,
  blueprint: WorkspaceBlueprint,
  meta: ApplyBlueprintMeta,
): Promise<void> {
  const profileData = {
    industryKey: blueprint.profile.industryKey,
    industryLabel: blueprint.profile.industryLabel,
    subIndustry: blueprint.profile.subIndustry ?? null,
    businessModel: blueprint.profile.businessModel ?? null,
    companySize: blueprint.profile.companySize ?? null,
    description: meta.answers?.description?.slice(0, 2000) ?? null,
    source: meta.source,
    provider: meta.provider ?? null,
    terminology: blueprint.terminology,
    dashboard: blueprint.dashboard,
    copilot: blueprint.copilot,
    automationIdeas: blueprint.automationIdeas,
    onboardingAnswers: (meta.answers ?? {}) as Prisma.InputJsonValue,
  }

  await prisma.workspaceProfile.upsert({
    where: { organizationId },
    create: { organizationId, ...profileData },
    update: profileData,
  })

  // Sequential on purpose — see module docblock. Existing objects (with their
  // fields) are fetched once so the loop below only writes what changed shape.
  const existing = await prisma.objectDefinition.findMany({
    where: { organizationId },
    include: { fields: { select: { id: true, key: true } } },
  })
  const objectIdByKey = new Map<string, string>()

  for (const [order, obj] of blueprint.objects.entries()) {
    const objData = {
      singular: obj.singular,
      plural: obj.plural,
      icon: obj.icon,
      color: obj.color ?? null,
      description: obj.description ?? null,
      order,
      pipeline: obj.pipeline ? (obj.pipeline as Prisma.InputJsonValue) : Prisma.DbNull,
      isArchived: false,
    }

    const found = existing.find((e) => e.key === obj.key)
    let objectId: string
    let existingFieldKeys: Set<string>

    if (found) {
      await prisma.objectDefinition.update({ where: { id: found.id }, data: objData })
      objectId = found.id
      existingFieldKeys = new Set(found.fields.map((f) => f.key))
    } else {
      const created = await prisma.objectDefinition.create({
        data: { organizationId, key: obj.key, ...objData },
      })
      objectId = created.id
      existingFieldKeys = new Set()
    }

    const fieldConfig = (f: (typeof obj.fields)[number]): Prisma.InputJsonValue => {
      const config: Record<string, unknown> = {}
      if (f.options?.length) config.options = f.options
      if (f.currency) config.currency = f.currency
      return config as Prisma.InputJsonValue
    }

    const freshFields = obj.fields.filter((f) => !existingFieldKeys.has(f.key))
    if (freshFields.length) {
      await prisma.fieldDefinition.createMany({
        data: freshFields.map((f) => ({
          objectId,
          key: f.key,
          label: f.label,
          type: f.type,
          config: fieldConfig(f),
          required: f.required,
          showInList: f.showInList,
          order: obj.fields.indexOf(f),
        })),
      })
    }
    for (const f of obj.fields.filter((f) => existingFieldKeys.has(f.key))) {
      await prisma.fieldDefinition.update({
        where: { objectId_key: { objectId, key: f.key } },
        data: {
          label: f.label,
          type: f.type,
          config: fieldConfig(f),
          required: f.required,
          showInList: f.showInList,
          order: obj.fields.indexOf(f),
          isArchived: false,
        },
      })
    }

    // Archive (never delete) fields the new blueprint no longer declares —
    // EXCEPT manually-added ones (config.source='manual'): the user's own
    // schema edits survive every regeneration.
    await prisma.fieldDefinition.updateMany({
      where: {
        objectId,
        key: { notIn: obj.fields.map((f) => f.key) },
        isArchived: false,
        NOT: { config: { path: ['source'], equals: 'manual' } },
      },
      data: { isArchived: true },
    })
    objectIdByKey.set(obj.key, objectId)
  }

  // Materialize blueprint automations (upsert by (objectId, key)); ones the
  // blueprint no longer declares are DEACTIVATED, never deleted (their fire
  // history stays intact and they revive on re-apply).
  const automationPairs: { objectId: string; key: string }[] = []
  for (const a of blueprint.automations) {
    const objectId = objectIdByKey.get(a.objectKey)
    if (!objectId) continue
    automationPairs.push({ objectId, key: a.key })
    await prisma.recordAutomation.upsert({
      where: { objectId_key: { objectId, key: a.key } },
      create: {
        organizationId,
        objectId,
        key: a.key,
        name: a.name,
        trigger: a.trigger as Prisma.InputJsonValue,
        action: a.action as Prisma.InputJsonValue,
        isActive: true,
      },
      update: {
        name: a.name,
        trigger: a.trigger as Prisma.InputJsonValue,
        action: a.action as Prisma.InputJsonValue,
        isActive: true,
      },
    })
  }
  await prisma.recordAutomation.updateMany({
    where: { organizationId, isActive: true, NOT: { OR: automationPairs } },
    data: { isActive: false },
  })

  // Archive (never delete) objects the new blueprint no longer declares —
  // their records stay intact and reappear if the object comes back.
  await prisma.objectDefinition.updateMany({
    where: { organizationId, key: { notIn: blueprint.objects.map((o) => o.key) }, isArchived: false },
    data: { isArchived: true },
  })

  await recordAudit({
    organizationId,
    actorId: meta.actorId ?? null,
    action: 'workspace.applied',
    summary: `Workspace configured as “${blueprint.profile.industryLabel}” (${blueprint.objects.length} objects, ${meta.provider ?? meta.source.toLowerCase()})`,
    targetType: 'workspace',
    targetId: organizationId,
  })
}

// ── Read-model ───────────────────────────────────────────────────────────────

function rowToObjectModel(row: {
  id: string
  key: string
  singular: string
  plural: string
  icon: string
  color: string | null
  description: string | null
  pipeline: Prisma.JsonValue | null
  fields: FieldRow[]
}): WorkspaceObjectModel {
  return {
    id: row.id,
    key: row.key,
    singular: row.singular,
    plural: row.plural,
    icon: row.icon,
    color: row.color,
    description: row.description,
    pipeline: parseStages(row.pipeline),
    fields: row.fields.map(fieldRowToSpec),
  }
}

const ACTIVE_FIELDS = {
  where: { isArchived: false },
  orderBy: { order: 'asc' },
  select: {
    key: true,
    label: true,
    type: true,
    config: true,
    required: true,
    showInList: true,
    order: true,
  },
} as const

/**
 * The one read-model behind every adaptive surface. Null when the org has no
 * workspace profile yet (pre-onboarding) — callers render generic defaults.
 * React-cached so layout + page + widgets share one lookup per request.
 */
export const getWorkspaceSchema = cache(
  async (organizationId: string): Promise<WorkspaceSchemaModel | null> => {
    const profile = await prisma.workspaceProfile.findUnique({ where: { organizationId } })
    if (!profile) return null

    const rows = await prisma.objectDefinition.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { order: 'asc' },
      include: { fields: ACTIVE_FIELDS },
    })

    const objects = rows.map(rowToObjectModel)
    const validKeys = new Set(objects.map((o) => o.key))

    return {
      profile: {
        industryKey: profile.industryKey,
        industryLabel: profile.industryLabel,
        subIndustry: profile.subIndustry,
        source: profile.source,
        provider: profile.provider === 'gemini' || profile.provider === 'local' ? profile.provider : null,
      },
      terminology: parseTerminology(profile.terminology),
      copilot: parseCopilot(profile.copilot),
      nav: objects.map((o) => ({ key: o.key, label: o.plural, icon: o.icon, href: `/o/${o.key}` })),
      objects,
      dashboard: parseWidgets(profile.dashboard, validKeys),
      automationIdeas: parseIdeas(profile.automationIdeas),
    }
  },
)

/** One active object + its active fields, or null (unknown/archived key). */
export async function getObjectByKey(
  organizationId: string,
  objectKey: string,
): Promise<WorkspaceObjectModel | null> {
  const row = await prisma.objectDefinition.findFirst({
    where: { organizationId, key: objectKey, isArchived: false },
    include: { fields: ACTIVE_FIELDS },
  })
  return row ? rowToObjectModel(row) : null
}

export type AddFieldResult =
  | { ok: true; field: FieldSpec }
  | { ok: false; error: string }

/**
 * Manually add ONE field to an object — the Phase-4 schema-editing entry
 * point. Blueprint bounds apply (max fields, option rules); the key derives
 * from the label (synthetic `field_N` fallback keeps non-latin labels
 * working) and the field is provenance-tagged `source:'manual'` in config —
 * the raw signal continuous learning will read later. Null = unknown object.
 */
export async function addFieldToObject(
  organizationId: string,
  objectKey: string,
  input: {
    label: string
    type: FieldTypeKey
    options?: string[]
    currency?: string
    required?: boolean
    showInList?: boolean
  },
): Promise<AddFieldResult | null> {
  const object = await getObjectByKey(organizationId, objectKey)
  if (!object) return null

  const label = input.label.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!label) return { ok: false, error: 'Field label is required' }
  if (!FIELD_TYPE_KEYS.includes(input.type)) return { ok: false, error: 'Unknown field type' }

  // Include archived fields in the bounds/uniqueness checks (keys must stay
  // unique across archived fields too — they can be revived by a re-apply).
  const allFields = await prisma.fieldDefinition.findMany({
    where: { objectId: object.id },
    select: { key: true, order: true },
  })
  if (allFields.length >= MAX_FIELDS_PER_OBJECT) {
    return { ok: false, error: `This object already has the maximum of ${MAX_FIELDS_PER_OBJECT} fields` }
  }

  const taken = new Set(allFields.map((f) => f.key))
  let key = keyFromLabel(label)
  if (!key) {
    let n = allFields.length + 1
    while (taken.has(`field_${n}`)) n++
    key = `field_${n}`
  }
  if (taken.has(key)) return { ok: false, error: `A “${label}” field already exists` }

  const wantsOptions = input.type === 'SELECT' || input.type === 'MULTI_SELECT'
  const options = wantsOptions
    ? (input.options ?? []).map((o) => o.trim().slice(0, 60)).filter(Boolean).slice(0, 24)
    : undefined
  if (wantsOptions && (!options || options.length < 2)) {
    return { ok: false, error: 'Select fields need at least two options' }
  }
  const currency =
    input.type === 'MONEY' && typeof input.currency === 'string' && /^[A-Za-z]{3}$/.test(input.currency.trim())
      ? input.currency.trim().toUpperCase()
      : undefined

  const config: Record<string, unknown> = { source: 'manual' }
  if (options) config.options = options
  if (currency) config.currency = currency

  const order = Math.max(-1, ...allFields.map((f) => f.order)) + 1
  const row = await prisma.fieldDefinition.create({
    data: {
      objectId: object.id,
      key,
      label,
      type: input.type,
      config: config as Prisma.InputJsonValue,
      required: input.required ?? false,
      showInList: input.showInList ?? true,
      order,
    },
  })
  return {
    ok: true,
    field: {
      key: row.key,
      label: row.label,
      type: row.type as FieldTypeKey,
      required: row.required,
      showInList: row.showInList,
      order: row.order,
      options,
      currency,
    },
  }
}

export interface WorkspaceAutomationModel {
  id: string
  name: string
  objectKey: string
  objectSingular: string
}

/** Active automations with their object identity (for the setup page list). */
export async function listActiveAutomations(organizationId: string): Promise<WorkspaceAutomationModel[]> {
  const rows = await prisma.recordAutomation.findMany({
    where: { organizationId, isActive: true },
    include: { object: { select: { key: true, singular: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({ id: r.id, name: r.name, objectKey: r.object.key, objectSingular: r.object.singular }))
}

/** Object by id (archived included — records of archived objects stay editable). */
export async function getObjectById(
  organizationId: string,
  objectId: string,
): Promise<WorkspaceObjectModel | null> {
  const row = await prisma.objectDefinition.findFirst({
    where: { id: objectId, organizationId },
    include: { fields: ACTIVE_FIELDS },
  })
  return row ? rowToObjectModel(row) : null
}
