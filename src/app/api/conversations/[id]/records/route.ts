import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import {
  linkRecordToConversation,
  listRecordsForConversation,
  unlinkRecordFromConversation,
} from '@/services/workspace/record.service'

/**
 * Workspace records linked to one conversation (both sides org-verified).
 *   GET    /api/conversations/:id/records            → { records }
 *   POST   /api/conversations/:id/records {recordId} → { record }
 *   DELETE /api/conversations/:id/records?linkId=    → { deleted: true }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireCan('records:read')
  if (!ctx) return error
  const { id } = await params
  const records = await listRecordsForConversation(ctx.organization.id, id)
  return ok({ records })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireCan('records:write')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'records')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const recordId = typeof body?.recordId === 'string' ? body.recordId : null
  if (!recordId) return err('recordId is required', 400)

  const record = await linkRecordToConversation(ctx.organization.id, id, recordId, ctx.userId)
  if (!record) return err('Conversation or record not found', 404)
  return ok({ record }, 201)
}

export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireCan('records:write')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'records')
  if (limited) return limited

  const linkId = new URL(req.url).searchParams.get('linkId')
  if (!linkId) return err('linkId is required', 400)
  const deleted = await unlinkRecordFromConversation(ctx.organization.id, linkId)
  if (!deleted) return err('Link not found', 404)
  return ok({ deleted: true })
}
