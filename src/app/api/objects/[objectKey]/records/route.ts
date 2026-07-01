import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { createRecord, listRecords } from '@/services/workspace/record.service'

/**
 * Records of one workspace object.
 *   GET  /api/objects/:objectKey/records?q=&stage=&limit=  → { object, records }
 *   POST /api/objects/:objectKey/records { title, stageKey?, data? } → { record }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ objectKey: string }> }) {
  const { ctx, error } = await requireCan('records:read')
  if (!ctx) return error

  const { objectKey } = await params
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? undefined
  const stageKey = url.searchParams.get('stage') ?? undefined
  const limitRaw = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined

  const result = await listRecords(ctx.organization.id, objectKey, { q, stageKey, limit })
  if (!result) return err('Unknown object', 404)
  return ok(result)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ objectKey: string }> }) {
  const { ctx, error } = await requireCan('records:write')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'records')
  if (limited) return limited

  const { objectKey } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)

  const result = await createRecord(
    ctx.organization.id,
    objectKey,
    { title: body.title, stageKey: body.stageKey, data: body.data },
    { userId: ctx.userId, membershipId: ctx.membership.id },
  )
  if (!result) return err('Unknown object', 404)
  if (!result.ok) return err(result.errors.join('; '), 400)
  return ok({ record: result.record }, 201)
}
