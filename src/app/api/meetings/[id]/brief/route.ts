import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { briefMeeting } from '@/services/meeting.service'

/**
 * Generate (or return the cached) AI pre-meeting brief. Interactive — the
 * page's brief card calls this on first view. `brief: null` means no AI
 * provider is available; the page keeps its deterministic sections.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'summarize')
  if (limited) return limited

  const { id } = await params
  const exists = await prisma.meeting.findFirst({ where: { id, userId: ctx.userId }, select: { id: true } })
  if (!exists) return err('Meeting not found', 404)

  const brief = await briefMeeting(ctx.userId, id)
  return ok({ brief })
}
