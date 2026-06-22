import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { getJob } from '@/services/jobs/queue'
import type { JobStatusResponse } from '@/types'

/**
 * Poll the status of a background job. Org-scoped: any member of the active org
 * can read a job owned by one of the org's members (so a shared-inbox sync
 * triggered under the connecting account is still pollable by the team).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const { id } = await params
  const job = await getJob(id)
  if (!job) return err('Not found', 404)

  const ownerInOrg =
    job.userId === ctx.userId ||
    (!!job.userId &&
      !!(await prisma.membership.findFirst({
        where: { userId: job.userId, organizationId: ctx.organization.id },
        select: { id: true },
      })))
  if (!ownerInOrg) return err('Not found', 404)

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
