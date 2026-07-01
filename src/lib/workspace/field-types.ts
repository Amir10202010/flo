/**
 * Field-type registry — the single source of truth for how each FieldType is
 * validated, stored and displayed. PURE (no DB, no React): the record
 * service validates writes through `validateRecordData`, and the UI picks its
 * input widget from `FieldTypeDef.input` and renders values via `format`.
 *
 * Storage shapes (inside CrmRecord.data):
 *   TEXT/LONG_TEXT/EMAIL/PHONE/URL/SELECT → string
 *   NUMBER/MONEY → number · BOOLEAN → boolean
 *   DATE → "YYYY-MM-DD" · DATETIME → "YYYY-MM-DDTHH:mm" (local, from the form)
 *   MULTI_SELECT → string[]
 */

export const FIELD_TYPE_KEYS = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'MONEY',
  'DATE',
  'DATETIME',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'EMAIL',
  'PHONE',
  'URL',
] as const

export type FieldTypeKey = (typeof FIELD_TYPE_KEYS)[number]

/** Serialized field definition consumed by validation, forms and list views. */
export interface FieldSpec {
  key: string
  label: string
  type: FieldTypeKey
  required: boolean
  showInList: boolean
  order: number
  /** SELECT / MULTI_SELECT choices. */
  options?: string[]
  /** MONEY ISO-4217 code (defaults to USD). */
  currency?: string
}

export type FieldInputKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'email'
  | 'tel'
  | 'url'

type CoerceResult = { value: unknown } | { error: string }

export interface FieldTypeDef {
  input: FieldInputKind
  /** Normalize an incoming value for storage, or explain why it is invalid. */
  coerce(value: unknown, field: FieldSpec): CoerceResult
  /** Human-readable rendering of a stored value (empty string for blanks). */
  format(value: unknown, field: FieldSpec): string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

function asTrimmedString(value: unknown, max: number): CoerceResult {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { error: 'must be text' }
  }
  return { value: String(value).trim().slice(0, max) }
}

function asFiniteNumber(value: unknown): CoerceResult {
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return { error: 'must be a number' }
  return { value: n }
}

export const FIELD_TYPES: Record<FieldTypeKey, FieldTypeDef> = {
  TEXT: {
    input: 'text',
    coerce: (v) => asTrimmedString(v, 500),
    format: (v) => String(v ?? ''),
  },
  LONG_TEXT: {
    input: 'textarea',
    coerce: (v) => asTrimmedString(v, 20_000),
    format: (v) => String(v ?? ''),
  },
  NUMBER: {
    input: 'number',
    coerce: (v) => asFiniteNumber(v),
    format: (v) => (typeof v === 'number' ? new Intl.NumberFormat('en-US').format(v) : String(v ?? '')),
  },
  MONEY: {
    input: 'number',
    coerce: (v) => asFiniteNumber(v),
    format: (v, field) => {
      const n = Number(v)
      if (!Number.isFinite(n)) return String(v ?? '')
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: field.currency ?? 'USD',
          maximumFractionDigits: 2,
        }).format(n)
      } catch {
        return new Intl.NumberFormat('en-US').format(n)
      }
    },
  },
  DATE: {
    input: 'date',
    coerce: (v) => {
      const s = String(v ?? '').trim()
      if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) return { error: 'must be a date (YYYY-MM-DD)' }
      return { value: s }
    },
    format: (v) => {
      const s = String(v ?? '')
      const t = Date.parse(s)
      if (Number.isNaN(t)) return s
      return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t)
    },
  },
  DATETIME: {
    input: 'datetime-local',
    coerce: (v) => {
      const s = String(v ?? '').trim()
      if (!DATETIME_RE.test(s) || Number.isNaN(Date.parse(s))) return { error: 'must be a date and time' }
      return { value: s }
    },
    format: (v) => {
      const s = String(v ?? '')
      const t = Date.parse(s)
      if (Number.isNaN(t)) return s
      return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(t)
    },
  },
  BOOLEAN: {
    input: 'checkbox',
    coerce: (v) => {
      if (typeof v === 'boolean') return { value: v }
      const s = String(v).trim().toLowerCase()
      if (s === 'true' || s === 'on' || s === '1') return { value: true }
      if (s === 'false' || s === 'off' || s === '0') return { value: false }
      return { error: 'must be yes or no' }
    },
    format: (v) => (v === true ? 'Yes' : v === false ? 'No' : ''),
  },
  SELECT: {
    input: 'select',
    coerce: (v, field) => {
      const s = String(v ?? '').trim()
      if (!s) return { error: 'must be one of the options' }
      if (field.options?.length && !field.options.includes(s)) {
        return { error: `must be one of: ${field.options.join(', ')}` }
      }
      return { value: s.slice(0, 100) }
    },
    format: (v) => String(v ?? ''),
  },
  MULTI_SELECT: {
    input: 'multiselect',
    coerce: (v, field) => {
      if (!Array.isArray(v)) return { error: 'must be a list' }
      const known = field.options?.length ? new Set(field.options) : null
      const values = v
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0 && (!known || known.has(s)))
        .slice(0, 20)
      return { value: values }
    },
    format: (v) => (Array.isArray(v) ? v.join(', ') : String(v ?? '')),
  },
  EMAIL: {
    input: 'email',
    coerce: (v) => {
      const s = String(v ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(s)) return { error: 'must be an email address' }
      return { value: s }
    },
    format: (v) => String(v ?? ''),
  },
  PHONE: {
    input: 'tel',
    coerce: (v) => {
      const s = String(v ?? '').trim()
      const digits = s.replace(/[\s\-().]/g, '')
      if (!/^\+?\d{5,15}$/.test(digits)) return { error: 'must be a phone number' }
      return { value: s.slice(0, 30) }
    },
    format: (v) => String(v ?? ''),
  },
  URL: {
    input: 'url',
    coerce: (v) => {
      const s = String(v ?? '').trim()
      try {
        const u = new URL(s)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'must be an http(s) link' }
        return { value: s.slice(0, 500) }
      } catch {
        return { error: 'must be a valid link' }
      }
    },
    format: (v) => String(v ?? ''),
  },
}

type ValidateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: string[] }

/** Is the incoming value "absent" for required/skip purposes? */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
}

/**
 * Validate + normalize record data against an object's field specs.
 * Unknown keys are stripped; blanks are omitted from the result (a PATCH that
 * wants to clear a field sends null in `partial` mode — see the note below).
 * `partial: true` (update path) skips the required check and treats explicit
 * nulls as "clear this field" by keeping them in the output.
 */
export function validateRecordData(
  fields: FieldSpec[],
  data: unknown,
  opts: { partial?: boolean } = {},
): ValidateResult {
  if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    return { ok: false, errors: ['record data must be an object'] }
  }
  const input = (data ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const errors: string[] = []

  for (const field of fields) {
    const has = Object.prototype.hasOwnProperty.call(input, field.key)
    const raw = input[field.key]

    if (opts.partial && has && raw === null) {
      out[field.key] = null // explicit clear on update
      continue
    }
    if (!has || isBlank(raw)) {
      if (field.required && !opts.partial) errors.push(`${field.label} is required`)
      continue
    }

    const result = FIELD_TYPES[field.type].coerce(raw, field)
    if ('error' in result) {
      errors.push(`${field.label} ${result.error}`)
    } else {
      out[field.key] = result.value
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, data: out }
}

/** Display a stored value using its field's registry formatter. */
export function formatFieldValue(field: FieldSpec, value: unknown): string {
  if (isBlank(value) || value === null) return ''
  return FIELD_TYPES[field.type].format(value, field)
}
