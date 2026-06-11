import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { enqueueGmailSync } from '@/services/jobs/queue'
import { kickJobQueue } from '@/services/jobs/kick'

// Allow the post-response `after()` drain to run up to the platform max.
export const maxDuration = 60

/**
 * Enqueue a Gmail sync job and return immediately (202). The sync runs in the
 * background — a post-response `after()` kick starts draining it instantly, and
 * the cron-driven /api/jobs/process drain is the backstop. The client polls
 * GET /api/jobs/[id] for the result.
 */
export async function POST() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId: user.id, type: 'GMAIL' } },
    select: { id: true, isActive: true },
  })
  if (!integration || !integration.isActive) {
    return NextResponse.json({ error: 'Gmail integration not found or inactive' }, { status: 400 })
  }

  const job = await enqueueGmailSync(user.id)
  kickJobQueue()
  return NextResponse.json({ jobId: job.id, status: 'queued' }, { status: 202 })
}
