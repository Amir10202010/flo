import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { captureMeeting } from '@/services/meeting.service'
import { kickJobQueue } from '@/services/jobs/kick'

/**
 * Ingest the meeting transcript / typed notes and queue the AI debrief.
 *   POST /api/meetings/:id/capture  { "transcript": string }
 * Returns 202 + the job id for polling via /api/jobs/:id.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = (await req.json().catch(() => null)) as { transcript?: unknown } | null
  const transcript = typeof body?.transcript === 'string' ? body.transcript : ''
  if (transcript.trim().length < 40) {
    return err('Paste the transcript or a few sentences of notes first (40+ characters)', 400)
  }

  const result = await captureMeeting(ctx.userId, id, transcript)
  if (!result) return err('Meeting not found', 404)
  kickJobQueue()
  return ok({ jobId: result.jobId }, 202)
}
