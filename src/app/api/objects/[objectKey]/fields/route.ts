import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { FIELD_TYPE_KEYS, type FieldTypeKey } from '@/lib/workspace/field-types'
import { addFieldToObject } from '@/services/workspace/workspace.service'

/**
 * Manual schema editing: add one field to a workspace object.
 *   POST /api/objects/:objectKey/fields
 *     { label, type, options?, currency?, required?, showInList? } → { field }
 * Admin-gated (schema shape affects the whole org).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ objectKey: string }> }) {
  const { ctx, error } = await requireCan('workspace:manage')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { objectKey } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)

  const label = typeof body.label === 'string' ? body.label : ''
  const type = FIELD_TYPE_KEYS.includes(body.type as FieldTypeKey) ? (body.type as FieldTypeKey) : null
  if (!type) return err('Unknown field type', 400)

  const options = Array.isArray(body.options)
    ? body.options.filter((o: unknown): o is string => typeof o === 'string')
    : undefined

  const result = await addFieldToObject(ctx.organization.id, objectKey, {
    label,
    type,
    options,
    currency: typeof body.currency === 'string' ? body.currency : undefined,
    required: body.required === true,
    showInList: body.showInList !== false,
  })
  if (!result) return err('Unknown object', 404)
  if (!result.ok) return err(result.error, 400)
  return ok({ field: result.field }, 201)
}
