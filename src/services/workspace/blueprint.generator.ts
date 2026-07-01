/**
 * AI workspace generator — turns onboarding answers into a WorkspaceBlueprint.
 *
 * Trust-boundary design (mirrors assistant.actions): the model never emits a
 * whole schema. It picks a base industry TEMPLATE and proposes bounded
 * CUSTOMIZATIONS (renames, extra fields/objects, terminology, persona);
 * deterministic code (`applyCustomization`) sanitizes every piece, resolves
 * the final blueprint and re-validates it through `safeParseBlueprint`.
 * Templates are the quality floor: with no API key (or any provider error on
 * this interactive path) the keyword-matched template ships as-is, tagged
 * `provider:'local'` so the UI can label it honestly.
 */
import { getTextProvider } from '@/services/ai'
import type { AiJsonSchema } from '@/services/ai/types'
import {
  MAX_AUTOMATION_IDEAS,
  MAX_FIELDS_PER_OBJECT,
  MAX_OBJECTS,
  MAX_STAGES,
  RESERVED_OBJECT_KEYS,
  safeParseBlueprint,
  type BlueprintField,
  type BlueprintObject,
  type BlueprintStage,
  type WorkspaceBlueprint,
  type WorkspaceBlueprintInput,
} from '@/lib/workspace/blueprint'
import { FIELD_TYPE_KEYS, type FieldTypeKey } from '@/lib/workspace/field-types'
import { isWorkspaceIcon, WORKSPACE_ICON_NAMES } from '@/lib/workspace/icons'
import {
  INDUSTRY_TEMPLATES,
  TEMPLATE_KEYS,
  pickTemplateByKeywords,
  type TemplateKey,
} from '@/lib/workspace/templates'

export interface OnboardingAnswers {
  /** "What does your company do?" — the anchor question. */
  description: string
  services?: string
  channels?: string
  salesProcess?: string
  teamSize?: string
}

export interface BlueprintCustomization {
  templateKey: TemplateKey
  industryLabel?: string
  subIndustry?: string
  businessModel?: string
  companySize?: string
  contactSingular?: string
  contactPlural?: string
  conversationSingular?: string
  conversationPlural?: string
  objectRenames?: { key: string; singular?: string; plural?: string }[]
  extraFields?: { objectKey: string; key: string; label: string; type: string; options?: string[] }[]
  extraObjects?: {
    key: string
    singular: string
    plural: string
    icon?: string
    description?: string
    fields?: { key: string; label: string; type: string; options?: string[] }[]
    pipeline?: { key: string; label: string }[]
  }[]
  removeObjectKeys?: string[]
  copilotTitle?: string
  copilotStyle?: string
  copilotFocus?: string[]
  automationIdeas?: string[]
}

export interface GeneratedBlueprint {
  blueprint: WorkspaceBlueprint
  provider: 'gemini' | 'local'
  templateKey: TemplateKey
}

// ── Sanitizers (deterministic — everything AI-shaped passes through these) ──

const KEY_RE = /^[a-z][a-z0-9_-]{1,31}$/

/** Coerce arbitrary text into a valid slug key ("School Grade" → "school_grade"). */
function sanitizeKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32)
  return KEY_RE.test(key) ? key : null
}

function cleanLabel(raw: unknown, max = 60): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, max)
  return s.length > 0 ? s : null
}

function sanitizeField(raw: { key: string; label: string; type: string; options?: string[] }, existingKeys: Set<string>): BlueprintField | null {
  const key = sanitizeKey(raw.key)
  const label = cleanLabel(raw.label)
  if (!key || !label || existingKeys.has(key)) return null
  if (!FIELD_TYPE_KEYS.includes(raw.type as FieldTypeKey)) return null
  const type = raw.type as FieldTypeKey
  const wantsOptions = type === 'SELECT' || type === 'MULTI_SELECT'
  const options = wantsOptions
    ? (raw.options ?? []).map((o) => cleanLabel(o)).filter((o): o is string => !!o).slice(0, 24)
    : undefined
  if (wantsOptions && (!options || options.length < 2)) return null
  return { key, label, type, required: false, showInList: true, options }
}

function sanitizeStage(raw: { key: string; label: string }, existingKeys: Set<string>): BlueprintStage | null {
  const key = sanitizeKey(raw.key)
  const label = cleanLabel(raw.label, 40)
  if (!key || !label || existingKeys.has(key)) return null
  return { key, label }
}

// ── Customization application (pure, exported for tests) ────────────────────

/**
 * Resolve a base template + AI customizations into a validated blueprint.
 * Invalid pieces are dropped (never fail the flow); the result is re-parsed,
 * and if that somehow fails the untouched base template is returned.
 */
export function applyCustomization(
  base: WorkspaceBlueprintInput,
  c: BlueprintCustomization,
): WorkspaceBlueprint {
  const parsedBase = safeParseBlueprint(base)
  if (!parsedBase.ok) throw new Error(`base template is invalid: ${parsedBase.error}`)
  const bp: WorkspaceBlueprint = structuredClone(parsedBase.blueprint)

  // Profile identity (industryKey stays the template's — it names the base).
  const label = cleanLabel(c.industryLabel, 80)
  if (label) bp.profile.industryLabel = label
  const sub = cleanLabel(c.subIndustry, 80)
  if (sub) bp.profile.subIndustry = sub
  const model = cleanLabel(c.businessModel, 80)
  if (model) bp.profile.businessModel = model
  const size = cleanLabel(c.companySize, 80)
  if (size) bp.profile.companySize = size

  // Terminology.
  const cs = cleanLabel(c.contactSingular)
  const cp = cleanLabel(c.contactPlural)
  if (cs && cp) bp.terminology.contact = { singular: cs, plural: cp }
  const vs = cleanLabel(c.conversationSingular)
  const vp = cleanLabel(c.conversationPlural)
  if (vs && vp) bp.terminology.conversation = { singular: vs, plural: vp }

  // Renames.
  for (const rename of c.objectRenames ?? []) {
    const obj = bp.objects.find((o) => o.key === rename.key)
    if (!obj) continue
    const singular = cleanLabel(rename.singular)
    const plural = cleanLabel(rename.plural)
    if (singular) obj.singular = singular
    if (plural) obj.plural = plural
  }

  // Removals — but never below one object.
  const removals = new Set((c.removeObjectKeys ?? []).filter((k) => typeof k === 'string'))
  if (removals.size) {
    const kept = bp.objects.filter((o) => !removals.has(o.key))
    if (kept.length >= 1) bp.objects = kept
  }

  // Extra objects.
  for (const raw of c.extraObjects ?? []) {
    if (bp.objects.length >= MAX_OBJECTS) break
    const key = sanitizeKey(raw.key)
    const singular = cleanLabel(raw.singular)
    const plural = cleanLabel(raw.plural)
    if (!key || !singular || !plural) continue
    if (RESERVED_OBJECT_KEYS.has(key) || bp.objects.some((o) => o.key === key)) continue

    const fieldKeys = new Set<string>()
    const fields: BlueprintField[] = []
    for (const f of raw.fields ?? []) {
      if (fields.length >= MAX_FIELDS_PER_OBJECT) break
      const clean = sanitizeField(f, fieldKeys)
      if (clean) {
        fields.push(clean)
        fieldKeys.add(clean.key)
      }
    }

    const stageKeys = new Set<string>()
    const stages: BlueprintStage[] = []
    for (const s of raw.pipeline ?? []) {
      if (stages.length >= MAX_STAGES) break
      const clean = sanitizeStage(s, stageKeys)
      if (clean) {
        stages.push(clean)
        stageKeys.add(clean.key)
      }
    }

    const obj: BlueprintObject = {
      key,
      singular,
      plural,
      icon: isWorkspaceIcon(raw.icon) ? raw.icon : 'box',
      description: cleanLabel(raw.description, 200) ?? undefined,
      fields,
      pipeline: stages.length >= 2 ? stages : undefined,
    }
    bp.objects.push(obj)
  }

  // Extra fields on existing (or just-added) objects.
  for (const raw of c.extraFields ?? []) {
    const obj = bp.objects.find((o) => o.key === raw.objectKey)
    if (!obj || obj.fields.length >= MAX_FIELDS_PER_OBJECT) continue
    const clean = sanitizeField(raw, new Set(obj.fields.map((f) => f.key)))
    if (clean) obj.fields.push(clean)
  }

  // Copilot persona.
  const title = cleanLabel(c.copilotTitle, 80)
  if (title) bp.copilot.title = title
  const style = cleanLabel(c.copilotStyle, 240)
  if (style) bp.copilot.style = style
  const focus = (c.copilotFocus ?? []).map((f) => cleanLabel(f, 80)).filter((f): f is string => !!f).slice(0, 6)
  if (focus.length) bp.copilot.focus = focus

  // Automation ideas (replace when provided — they should fit THIS business).
  const ideas = (c.automationIdeas ?? [])
    .map((i) => cleanLabel(i, 200))
    .filter((i): i is string => !!i)
    .slice(0, MAX_AUTOMATION_IDEAS)
  if (ideas.length) bp.automationIdeas = ideas

  const reparsed = safeParseBlueprint(bp)
  return reparsed.ok ? reparsed.blueprint : parsedBase.blueprint
}

// ── AI generation ────────────────────────────────────────────────────────────

const CUSTOMIZATION_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    templateKey: {
      type: 'string',
      format: 'enum',
      enum: [...TEMPLATE_KEYS],
      description: 'The closest base template for this business. Use "generic" only when nothing fits.',
    },
    industryLabel: { type: 'string', description: 'Short industry name in the language of the business description, e.g. "Pediatric dental clinic".' },
    subIndustry: { type: 'string', description: 'Narrower niche when clear from the description. Omit otherwise.' },
    businessModel: { type: 'string', description: 'How they make money, a few words. Omit if unclear.' },
    companySize: { type: 'string', description: 'Team size hint if mentioned, e.g. "2-10 people".' },
    contactSingular: { type: 'string', description: 'What THIS business calls one person who contacts them (Patient, Guest, Employer…). In the description language.' },
    contactPlural: { type: 'string', description: 'Plural of contactSingular.' },
    conversationSingular: { type: 'string', description: 'What they call one email thread (Inquiry, Booking request…). Omit to keep "Conversation".' },
    conversationPlural: { type: 'string', description: 'Plural of conversationSingular.' },
    objectRenames: {
      type: 'array',
      description: 'Rename template objects to this business\'s own vocabulary. Only when clearly better.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Existing object key from the chosen template.' },
          singular: { type: 'string' },
          plural: { type: 'string' },
        },
        required: ['key'],
      },
    },
    extraFields: {
      type: 'array',
      description: 'Up to 10 extra fields the description implies (e.g. "insurance number", "car model"). Keys are english slugs; labels in the description language.',
      items: {
        type: 'object',
        properties: {
          objectKey: { type: 'string' },
          key: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', format: 'enum', enum: [...FIELD_TYPE_KEYS] },
          options: { type: 'array', items: { type: 'string' }, description: 'Required for SELECT / MULTI_SELECT (2+ choices).' },
        },
        required: ['objectKey', 'key', 'label', 'type'],
      },
    },
    extraObjects: {
      type: 'array',
      description: 'Up to 3 additional objects this business tracks that the template lacks.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          singular: { type: 'string' },
          plural: { type: 'string' },
          icon: { type: 'string', description: 'One of the allowed icon names.' },
          description: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string', format: 'enum', enum: [...FIELD_TYPE_KEYS] },
                options: { type: 'array', items: { type: 'string' } },
              },
              required: ['key', 'label', 'type'],
            },
          },
          pipeline: {
            type: 'array',
            description: 'Ordered workflow stages (2-8) if this object moves through a process.',
            items: {
              type: 'object',
              properties: { key: { type: 'string' }, label: { type: 'string' } },
              required: ['key', 'label'],
            },
          },
        },
        required: ['key', 'singular', 'plural'],
      },
    },
    removeObjectKeys: {
      type: 'array',
      items: { type: 'string' },
      description: 'Template objects this business clearly does NOT need.',
    },
    copilotTitle: { type: 'string', description: 'Persona name for their AI copilot, e.g. "Dental practice copilot".' },
    copilotStyle: { type: 'string', description: 'One sentence on tone + domain vocabulary for the copilot.' },
    copilotFocus: { type: 'array', items: { type: 'string' }, description: 'Up to 6 things the copilot should watch for this business.' },
    automationIdeas: { type: 'array', items: { type: 'string' }, description: 'Up to 6 automation ideas phrased for THIS business.' },
  },
  required: ['templateKey', 'industryLabel'],
}

function answersText(a: OnboardingAnswers): string {
  return [
    `What the company does: ${a.description}`,
    a.services ? `Services: ${a.services}` : null,
    a.channels ? `How customers reach them: ${a.channels}` : null,
    a.salesProcess ? `Sales process: ${a.salesProcess}` : null,
    a.teamSize ? `Team size: ${a.teamSize}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildGeneratorPrompt(a: OnboardingAnswers): string {
  const templateLines = TEMPLATE_KEYS.map((key) => {
    const t = INDUSTRY_TEMPLATES[key]
    const objects = (t.blueprint.objects ?? []).map((o) => `${o.key} (${o.plural})`).join(', ')
    return `- ${key}: ${t.label} — objects: ${objects}`
  }).join('\n')

  return `You are configuring a CRM workspace so it feels purpose-built for one specific business.

BUSINESS (answers from onboarding, any language):
${answersText(a)}

BASE TEMPLATES (pick the closest):
${templateLines}

Customize the chosen template for THIS business:
- Rename objects/terminology into the business's own vocabulary, in the SAME LANGUAGE as their description.
- Add the few extra fields or objects their description clearly implies — no speculative bloat.
- Remove template objects they obviously don't need.
- Keys must be short english slugs (lowercase, underscores); labels in their language.
- Allowed icon names: ${WORKSPACE_ICON_NAMES.join(', ')}.
- Give their AI copilot a fitting persona and 3-6 automation ideas phrased for their workflow.

Return a JSON object matching the provided schema. Be conservative: a small, accurate workspace beats a bloated one.`
}

function coerceCustomization(raw: unknown): BlueprintCustomization | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const templateKey = TEMPLATE_KEYS.includes(r.templateKey as TemplateKey)
    ? (r.templateKey as TemplateKey)
    : null
  if (!templateKey) return null

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined)
  const objArr = <T,>(v: unknown): T[] | undefined =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : undefined

  return {
    templateKey,
    industryLabel: str(r.industryLabel),
    subIndustry: str(r.subIndustry),
    businessModel: str(r.businessModel),
    companySize: str(r.companySize),
    contactSingular: str(r.contactSingular),
    contactPlural: str(r.contactPlural),
    conversationSingular: str(r.conversationSingular),
    conversationPlural: str(r.conversationPlural),
    objectRenames: objArr(r.objectRenames),
    extraFields: objArr(r.extraFields)?.slice(0, 10) as BlueprintCustomization['extraFields'],
    extraObjects: objArr(r.extraObjects)?.slice(0, 3) as BlueprintCustomization['extraObjects'],
    removeObjectKeys: strArr(r.removeObjectKeys),
    copilotTitle: str(r.copilotTitle),
    copilotStyle: str(r.copilotStyle),
    copilotFocus: strArr(r.copilotFocus),
    automationIdeas: strArr(r.automationIdeas),
  }
}

function templateBlueprint(key: TemplateKey): WorkspaceBlueprint {
  const parsed = safeParseBlueprint(INDUSTRY_TEMPLATES[key].blueprint)
  if (!parsed.ok) throw new Error(`template "${key}" failed validation: ${parsed.error}`)
  return parsed.blueprint
}

/**
 * Generate a workspace blueprint from onboarding answers.
 *
 * - `opts.templateKey` (user picked a template manually) → that template as-is.
 * - AI provider available → template + AI customization (`provider:'gemini'`).
 * - No provider / ANY provider error → keyword-matched template
 *   (`provider:'local'`). Interactive path: never rethrows, always answers.
 */
export async function generateWorkspaceBlueprint(
  answers: OnboardingAnswers,
  opts: { templateKey?: TemplateKey } = {},
): Promise<GeneratedBlueprint> {
  if (opts.templateKey) {
    return { blueprint: templateBlueprint(opts.templateKey), provider: 'local', templateKey: opts.templateKey }
  }

  const provider = getTextProvider()
  if (provider) {
    try {
      const raw = await provider.generateJson({
        prompt: buildGeneratorPrompt(answers),
        schema: CUSTOMIZATION_SCHEMA,
        maxOutputTokens: 2048,
      })
      const customization = coerceCustomization(raw)
      if (customization) {
        const blueprint = applyCustomization(
          INDUSTRY_TEMPLATES[customization.templateKey].blueprint,
          customization,
        )
        return { blueprint, provider: 'gemini', templateKey: customization.templateKey }
      }
      console.warn('[workspace] generator returned an unusable customization; using local template')
    } catch (err) {
      console.warn(`[workspace] ${provider.name} generation failed (${String(err)}); using local template`)
    }
  }

  const fallbackKey = pickTemplateByKeywords(answersText(answers))
  return { blueprint: templateBlueprint(fallbackKey), provider: 'local', templateKey: fallbackKey }
}
