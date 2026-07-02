import { type NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { searchRecords } from '@/services/workspace/record.service'

/**
 * Record title search across all active workspace objects — powers the
 * thread "link a record" picker.
 *   GET /api/workspace/records/search?q= → { records }
 */
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireCan('records:read')
  if (!ctx) return error
  const q = new URL(req.url).searchParams.get('q') ?? ''
  const records = q.trim().length >= 2 ? await searchRecords(ctx.organization.id, q) : []
  return ok({ records })
}
