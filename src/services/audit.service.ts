/**
 * Append-only organization audit log. Every privileged or collaborative action
 * (member/role changes, inbox connect/disconnect, assignment, state change,
 * rule/template/tag CRUD, billing, org settings) records one row here so admins
 * have an accountable history. `actorId` is null for system/automation actions.
 */
import { prisma } from '@/lib/prisma'

export interface AuditEntry {
  organizationId: string
  actorId?: string | null
  action: string // dotted verb, e.g. 'member.invited', 'conversation.assigned'
  summary: string // human-readable, already-formatted line
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}

/** Record one audit entry. Never throws into the caller's happy path — a failed
 * audit write must not break the action it describes. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        summary: entry.summary,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: (entry.metadata ?? {}) as object,
      },
    })
  } catch (e) {
    console.error('[audit] failed to record', entry.action, e instanceof Error ? e.message : e)
  }
}

export interface AuditRow {
  id: string
  actorId: string | null
  action: string
  summary: string
  targetType: string | null
  targetId: string | null
  createdAt: Date
}

/** Most-recent-first audit entries for an organization. */
export async function listAudit(organizationId: string, limit = 100): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 250),
    select: {
      id: true, actorId: true, action: true, summary: true,
      targetType: true, targetId: true, createdAt: true,
    },
  })
  return rows
}
