/**
 * The WorkspaceBlueprint contract — the single generation artifact of the
 * adaptive workspace. Industry templates export one, the AI generator emits
 * one, the onboarding preview renders one, and the materializer applies one.
 *
 * Everything that reaches the database goes through `safeParseBlueprint`:
 * Zod validation with hard bounds (object/field/stage/widget counts, slug
 * keys, bounded icon registry, no reserved keys) plus a normalization pass
 * that drops dashboard widgets referencing unknown objects. Nothing
 * AI-emitted is trusted past this file.
 */
import { z } from 'zod'
import { FIELD_TYPE_KEYS } from './field-types'
import { isWorkspaceIcon } from './icons'
import type { Term } from './terminology'

export const MAX_OBJECTS = 12
export const MAX_FIELDS_PER_OBJECT = 30
export const MAX_STAGES = 12
export const MAX_WIDGETS = 8
export const MAX_AUTOMATION_IDEAS = 8

/** Route segments and native surfaces a workspace object may not shadow. */
export const RESERVED_OBJECT_KEYS = new Set([
  'admin',
  'api',
  'clients',
  'contact',
  'contacts',
  'conversation',
  'conversations',
  'dashboard',
  'inbox',
  'o',
  'object',
  'objects',
  'org',
  'record',
  'records',
  'settings',
  'workspace',
])

const KEY_RE = /^[a-z][a-z0-9_-]{1,31}$/

const Key = z.string().regex(KEY_RE, 'keys are lowercase slugs (a-z, 0-9, _, -; max 32 chars)')
const Label = z.string().trim().min(1).max(60)
const ShortText = z.string().trim().min(1).max(80)

function uniqueKeys<T>(get: (item: T) => string, what: string) {
  return (arr: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>()
    for (const item of arr) {
      const k = get(item)
      if (seen.has(k)) ctx.addIssue({ code: 'custom', message: `duplicate ${what} key "${k}"` })
      seen.add(k)
    }
  }
}

const BlueprintStageSchema = z.object({
  key: Key,
  label: Label,
  color: z.string().trim().max(24).optional(),
  /** Terminal stages (Won/Lost/Completed) sit at the end of boards/funnels. */
  terminal: z.boolean().optional(),
})

const BlueprintFieldSchema = z.object({
  key: Key,
  label: Label,
  type: z.enum(FIELD_TYPE_KEYS),
  required: z.boolean().default(false),
  showInList: z.boolean().default(true),
  /** SELECT / MULTI_SELECT choices. */
  options: z.array(z.string().trim().min(1).max(60)).max(24).optional(),
  /** MONEY ISO-4217 currency code. */
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'ISO currency code').optional(),
})

const BlueprintObjectSchema = z.object({
  key: Key.refine((k) => !RESERVED_OBJECT_KEYS.has(k), 'this key is reserved'),
  singular: Label,
  plural: Label,
  icon: z.string().refine(isWorkspaceIcon, 'unknown icon — pick from the workspace icon registry'),
  color: z.string().trim().max(24).optional(),
  description: z.string().trim().max(200).optional(),
  fields: z
    .array(BlueprintFieldSchema)
    .max(MAX_FIELDS_PER_OBJECT)
    .superRefine(uniqueKeys((f) => f.key, 'field')),
  pipeline: z
    .array(BlueprintStageSchema)
    .min(2)
    .max(MAX_STAGES)
    .superRefine(uniqueKeys((s) => s.key, 'stage'))
    .optional(),
})

const BlueprintWidgetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('object-count'), objectKey: Key, label: Label.optional() }),
  z.object({ type: z.literal('stage-breakdown'), objectKey: Key, label: Label.optional() }),
])

/** Re-validators for blueprint-shaped JSON stored on WorkspaceProfile /
 * ObjectDefinition rows — corrupt data degrades to defaults instead of
 * crashing the read-model. */
export const StoredStagesSchema = z.array(BlueprintStageSchema).min(1)
export const StoredWidgetsSchema = z.array(BlueprintWidgetSchema)

export const BlueprintCopilotSchema = z.object({
  /** Persona headline, e.g. "Dental practice copilot". */
  title: z.string().trim().min(1).max(80),
  /** One-line voice/behavior hint injected into assistant prompts. */
  style: z.string().trim().max(240).optional(),
  /** Domains the copilot should watch (shown as chips + prompt bullets). */
  focus: z.array(ShortText).max(6).optional(),
})

export const TerminologySchema = z.record(
  z.string().regex(KEY_RE),
  z.object({ singular: Label, plural: Label }),
)

const BlueprintProfileSchema = z.object({
  industryKey: Key,
  industryLabel: ShortText,
  subIndustry: ShortText.optional(),
  businessModel: ShortText.optional(),
  companySize: ShortText.optional(),
})

export const WorkspaceBlueprintSchema = z.object({
  profile: BlueprintProfileSchema,
  terminology: TerminologySchema.default({}),
  objects: z
    .array(BlueprintObjectSchema)
    .min(1)
    .max(MAX_OBJECTS)
    .superRefine(uniqueKeys((o) => o.key, 'object')),
  dashboard: z.array(BlueprintWidgetSchema).max(MAX_WIDGETS).default([]),
  copilot: BlueprintCopilotSchema.default({ title: 'Workspace copilot' }),
  automationIdeas: z.array(z.string().trim().min(1).max(200)).max(MAX_AUTOMATION_IDEAS).default([]),
})

export type WorkspaceBlueprint = z.infer<typeof WorkspaceBlueprintSchema>
/** Author-side shape (defaults still optional) — what templates are written in. */
export type WorkspaceBlueprintInput = z.input<typeof WorkspaceBlueprintSchema>
export type BlueprintObject = WorkspaceBlueprint['objects'][number]
export type BlueprintField = BlueprintObject['fields'][number]
export type BlueprintStage = NonNullable<BlueprintObject['pipeline']>[number]
export type BlueprintWidget = WorkspaceBlueprint['dashboard'][number]
export type BlueprintCopilot = WorkspaceBlueprint['copilot']
export type BlueprintTerminology = Record<string, Term>

/**
 * Post-parse fixups that should degrade rather than reject: dashboard widgets
 * pointing at objects the blueprint doesn't define (or stage widgets for
 * pipeline-less objects) are dropped silently.
 */
function normalizeBlueprint(bp: WorkspaceBlueprint): WorkspaceBlueprint {
  const byKey = new Map(bp.objects.map((o) => [o.key, o]))
  const dashboard = bp.dashboard.filter((w) => {
    const target = byKey.get(w.objectKey)
    if (!target) return false
    if (w.type === 'stage-breakdown' && !target.pipeline?.length) return false
    return true
  })
  return { ...bp, dashboard }
}

export type BlueprintParseResult =
  | { ok: true; blueprint: WorkspaceBlueprint }
  | { ok: false; error: string }

/** The one gate between untrusted blueprint JSON and the rest of the system. */
export function safeParseBlueprint(raw: unknown): BlueprintParseResult {
  const parsed = WorkspaceBlueprintSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return { ok: false, error: issues || 'invalid blueprint' }
  }
  return { ok: true, blueprint: normalizeBlueprint(parsed.data) }
}
