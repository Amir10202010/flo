import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { listAudit } from '@/services/audit.service'

/** Recent organization audit log (admin+). Actor names are resolved for display. */
export async function GET() {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error

  const rows = await listAudit(ctx.organization.id, 120)
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))]
  const users = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : []
  const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email]))

  return ok({
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      summary: r.summary,
      actorName: r.actorId ? nameById.get(r.actorId) ?? 'Someone' : 'System',
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
