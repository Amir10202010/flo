import { getAuthUser, ok, err } from '@/lib/api'
import { getJob } from '@/services/jobs/queue'
import type { JobStatusResponse } from '@/types'

/**
 * Poll the status of a background job. Scoped to the owner: a user can only read
 * jobs they enqueued (userId on the job row).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { id } = await params
  const job = await getJob(id)

  if (!job || job.userId !== user.id) return err('Not found', 404)

  const body: JobStatusResponse = {
    id: job.id,
    type: job.type as JobStatusResponse['type'],
    status: job.status as JobStatusResponse['status'],
    result: job.result ?? null,
    error: job.error,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  }
  return ok(body)
}
