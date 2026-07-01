/**
 * Industry template registry. Adding an industry = adding one blueprint file
 * and registering it here (application code never mentions industries).
 * Templates are the quality floor for AI generation and the whole answer in
 * offline mode; `pickTemplateByKeywords` is the deterministic en+ru fallback.
 */
import type { WorkspaceBlueprintInput } from '../blueprint'
import { dentalClinicBlueprint } from './dental-clinic'
import { marketingAgencyBlueprint } from './marketing-agency'
import { lawFirmBlueprint } from './law-firm'
import { recruitingAgencyBlueprint } from './recruiting-agency'
import { realEstateBlueprint } from './real-estate'
import { genericBlueprint } from './generic'

export interface IndustryTemplate {
  key: TemplateKey
  label: string
  /** Lowercase stems (en+ru) matched at word starts by the picker. */
  keywords: string[]
  blueprint: WorkspaceBlueprintInput
}

export type TemplateKey =
  | 'dental-clinic'
  | 'marketing-agency'
  | 'law-firm'
  | 'recruiting-agency'
  | 'real-estate'
  | 'generic'

export const INDUSTRY_TEMPLATES: Record<TemplateKey, IndustryTemplate> = {
  'dental-clinic': {
    key: 'dental-clinic',
    label: 'Dental clinic',
    keywords: ['dental', 'dentist', 'orthodont', 'implant', 'teeth', 'tooth', 'стоматолог', 'зубн', 'дантист', 'ортодонт'],
    blueprint: dentalClinicBlueprint,
  },
  'marketing-agency': {
    key: 'marketing-agency',
    label: 'Marketing agency',
    keywords: ['marketing', 'campaign', 'branding', 'advertising', 'creative agency', 'smm', 'seo', 'маркетинг', 'реклам', 'бренд', 'кампани', 'креатив'],
    blueprint: marketingAgencyBlueprint,
  },
  'law-firm': {
    key: 'law-firm',
    label: 'Law firm',
    keywords: ['law', 'legal', 'lawyer', 'attorney', 'litigation', 'court', 'notary', 'юрист', 'юридическ', 'адвокат', 'суд', 'правов', 'нотариус'],
    blueprint: lawFirmBlueprint,
  },
  'recruiting-agency': {
    key: 'recruiting-agency',
    label: 'Recruiting agency',
    keywords: ['recruit', 'staffing', 'talent', 'headhunt', 'hiring', 'candidate', 'vacanc', 'рекрут', 'подбор', 'кадров', 'вакансия', 'кандидат', 'хедхант'],
    blueprint: recruitingAgencyBlueprint,
  },
  'real-estate': {
    key: 'real-estate',
    label: 'Real estate agency',
    keywords: ['real estate', 'realtor', 'property', 'properties', 'listing', 'apartment', 'mortgage', 'недвижимост', 'риэлтор', 'риелтор', 'квартир', 'ипотек', 'жиль'],
    blueprint: realEstateBlueprint,
  },
  generic: {
    key: 'generic',
    label: 'General business',
    keywords: [],
    blueprint: genericBlueprint,
  },
}

export const TEMPLATE_KEYS = Object.keys(INDUSTRY_TEMPLATES) as TemplateKey[]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Deterministic template selection from a business description (any casing,
 * en+ru). Keywords are stems matched at word starts (so "стоматолог" matches
 * "стоматологическая" but "ads" never matches "roads"). Highest hit count
 * wins; no hits → generic.
 */
export function pickTemplateByKeywords(text: string): TemplateKey {
  const haystack = ` ${text.toLowerCase()} `
  let best: TemplateKey = 'generic'
  let bestScore = 0
  for (const key of TEMPLATE_KEYS) {
    if (key === 'generic') continue
    let score = 0
    for (const kw of INDUSTRY_TEMPLATES[key].keywords) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(kw)}`, 'u')
      if (re.test(haystack)) score++
    }
    if (score > bestScore) {
      best = key
      bestScore = score
    }
  }
  return best
}
