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
  StoredStagesSchema,
  StoredWidgetsSchema,
  TerminologySchema,
  BlueprintCopilotSchema,
  type BlueprintStage,
  type BlueprintWidget,
  type BlueprintCopilot,
  type WorkspaceBlueprint,
} from '@/lib/workspace/blueprint'
import type { FieldSpec, FieldTypeKey } from '@/lib/workspace/field-types'
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

    // Archive (never delete) fields the new blueprint no longer declares.
    await prisma.fieldDefinition.updateMany({
      where: { objectId, key: { notIn: obj.fields.map((f) => f.key) }, isArchived: false },
      data: { isArchived: true },
    })
  }

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
