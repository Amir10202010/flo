import type { RiskAlert } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadWorkspace } from './metrics.helpers'
import { computeAlerts } from './alert.engine'
import { timeAgo } from '@/lib/time'
import type { AlertStatusValue, RiskAlertItem, RiskLevel } from '@/types'

/**
 * Risk-alert lifecycle. scanRiskAlerts() is idempotent and runs after every
 * Gmail sync plus on the daily cron:
 *
 *   condition appears   → alert created OPEN (one row per dedupeKey)
 *   condition persists  → severity/reason/lastSeenAt refreshed (status kept)
 *   condition clears    → OPEN/ACKNOWLEDGED rows auto-resolve (resolvedBy 'auto')
 *   condition returns   → resolved row reopens — except user-resolved rows,
 *                         which get a 7-day cooldown so the scanner never
 *                         immediately undoes a human decision.
 */

const USER_RESOLVE_COOLDOWN_MS = 7 * 86_400_000

export interface ScanResult {
  created: number
  refreshed: number
  reopened: number
  autoResolved: number
  open: number
}

export async function scanRiskAlerts(organizationId: string): Promise<ScanResult> {
  const ws = await loadWorkspace(organizationId)
  const candidates = computeAlerts(ws)
  const now = new Date()

  // Alerts are org-scoped (the team shares them). RiskAlert.userId is a required
  // FK, so created rows are attributed to the org owner (any active member as a
  // fallback) — but dedupe and every read scope on organizationId.
  const owner = await prisma.membership.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    orderBy: { role: 'asc' }, // OWNER sorts before others alphabetically
    select: { userId: true },
  })
  const ownerId = owner?.userId
  if (!ownerId) return { created: 0, refreshed: 0, reopened: 0, autoResolved: 0, open: 0 }

  const existing = await prisma.riskAlert.findMany({ where: { organizationId } })
  const byKey = new Map(existing.map((a) => [a.dedupeKey, a]))

  let created = 0
  let refreshed = 0
  let reopened = 0

  const activeKeys = new Set<string>()
  for (const c of candidates) {
    const dedupeKey = `${organizationId}:${c.type}:${c.dedupeScope}`
    activeKeys.add(dedupeKey)
    const prev = byKey.get(dedupeKey)

    if (!prev) {
      await prisma.riskAlert.create({
        data: {
          organizationId,
          userId: ownerId,
          conversationId: c.conversationId,
          type: c.type,
          severity: c.severity,
          title: c.title,
          reason: c.reason,
          suggestedAction: c.suggestedAction,
          dedupeKey,
        },
      })
      created++
      continue
    }

    if (prev.status === 'RESOLVED') {
      const cooldownActive =
        prev.resolvedBy === 'user' &&
        prev.resolvedAt !== null &&
        now.getTime() - prev.resolvedAt.getTime() < USER_RESOLVE_COOLDOWN_MS
      if (cooldownActive) continue

      await prisma.riskAlert.update({
        where: { id: prev.id },
        data: {
          status: 'OPEN',
          severity: c.severity,
          title: c.title,
          reason: c.reason,
          suggestedAction: c.suggestedAction,
          conversationId: c.conversationId,
          lastSeenAt: now,
          acknowledgedAt: null,
          resolvedAt: null,
          resolvedBy: null,
          // A condition that returned is "fresh" again: clear any prior snooze
          // and the notify guard so a re-emerged urgent alert can re-notify.
          snoozedUntil: null,
          notifiedAt: null,
        },
      })
      reopened++
      continue
    }

    // OPEN / ACKNOWLEDGED — refresh the facts, keep the user's status.
    await prisma.riskAlert.update({
      where: { id: prev.id },
      data: {
        severity: c.severity,
        title: c.title,
        reason: c.reason,
        suggestedAction: c.suggestedAction,
        conversationId: c.conversationId,
        lastSeenAt: now,
      },
    })
    refreshed++
  }

  // Conditions that cleared since the last scan → auto-resolve.
  const staleIds = existing
    .filter((a) => (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED') && !activeKeys.has(a.dedupeKey))
    .map((a) => a.id)
  if (staleIds.length) {
    await prisma.riskAlert.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: 'auto' },
    })
  }

  return {
    created,
    refreshed,
    reopened,
    autoResolved: staleIds.length,
    open: activeKeys.size,
  }
}

// ── Read model + status transitions (API/UI) ────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

function toItem(a: RiskAlert, now: number): RiskAlertItem {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity as RiskLevel,
    status: a.status as AlertStatusValue,
    title: a.title,
    reason: a.reason,
    suggestedAction: a.suggestedAction,
    conversationId: a.conversationId,
    href: a.conversationId ? `/inbox/${a.conversationId}` : null,
    firstSeenAgo: timeAgo(a.firstSeenAt, now),
    lastSeenAgo: timeAgo(a.lastSeenAt, now),
  }
}

export async function listRiskAlerts(
  organizationId: string,
  statuses: AlertStatusValue[] = ['OPEN', 'ACKNOWLEDGED'],
  limit = 50,
): Promise<RiskAlertItem[]> {
  const rows = await prisma.riskAlert.findMany({
    where: {
      organizationId,
      status: { in: statuses },
      // Actively-snoozed alerts are intentionally hidden until they wake up.
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
    orderBy: { lastSeenAt: 'desc' },
    take: limit,
  })
  const now = Date.now()
  return rows
    .sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
        b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
    )
    .map((a) => toItem(a, now))
}

export type AlertAction = 'acknowledge' | 'resolve' | 'reopen' | 'snooze'

const DEFAULT_SNOOZE_DAYS = 3

/** Apply a user status transition; returns null when the alert isn't theirs. */
export async function setAlertStatus(
  organizationId: string,
  alertId: string,
  action: AlertAction,
  opts: { snoozeDays?: number } = {},
): Promise<RiskAlertItem | null> {
  const alert = await prisma.riskAlert.findFirst({ where: { id: alertId, organizationId } })
  if (!alert) return null

  const now = new Date()
  const data =
    action === 'acknowledge'
      ? { status: 'ACKNOWLEDGED' as const, acknowledgedAt: now }
      : action === 'resolve'
        ? { status: 'RESOLVED' as const, resolvedAt: now, resolvedBy: 'user' }
        : action === 'snooze'
          ? {
              // Keep the status; just hide it (and suppress notifications) until
              // it wakes up. Treated as seen, so mark acknowledged if it wasn't.
              snoozedUntil: new Date(now.getTime() + (opts.snoozeDays ?? DEFAULT_SNOOZE_DAYS) * 86_400_000),
              acknowledgedAt: alert.acknowledgedAt ?? now,
            }
          : { status: 'OPEN' as const, acknowledgedAt: null, resolvedAt: null, resolvedBy: null, snoozedUntil: null }

  const updated = await prisma.riskAlert.update({ where: { id: alert.id }, data })
  return toItem(updated, Date.now())
}
