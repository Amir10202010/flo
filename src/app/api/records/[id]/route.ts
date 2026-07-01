import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { deleteRecord, updateRecord } from '@/services/workspace/record.service'

/**
 * One workspace record (org-scoped).
 *   PATCH  /api/records/:id { title?, stageKey?, data? } → { record }
 *          `data` merges partially; explicit nulls clear a field.
 *   DELETE /api/records/:id → { deleted: true }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireCan('records:write')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'records')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)

  const result = await updateRecord(ctx.organization.id, id, {
    title: body.title,
    stageKey: body.stageKey,
    data: body.data,
  })
  if (!result) return err('Record not found', 404)
  if (!result.ok) return err(result.errors.join('; '), 400)
  return ok({ record: result.record })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireCan('records:write')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'records')
  if (limited) return limited

  const { id } = await params
  const deleted = await deleteRecord(ctx.organization.id, id)
  if (!deleted) return err('Record not found', 404)
  return ok({ deleted: true })
}
