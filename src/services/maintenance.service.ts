import { prisma } from '@/lib/prisma'
import { enqueueCalendarSync, enqueueGmailSync, enqueueScanRiskAlerts, enqueueNotifyAlerts, enqueueMany, enqueueDeduped } from './jobs/queue'
import { startGmailWatch } from './gmail.service'
import { findUnembeddedConversationIds } from './embedding.service'
import { isoWeekKey } from './digest.service'
import { getTextProvider } from './ai'

/**
 * Per-connector daily maintenance, run from the GMAIL_MAINTENANCE job (one per
 * active integration). This used to live inline in /api/cron/gmail's
 * per-integration loop, which made a single cron invocation O(N integrations) —
 * at scale it timed out before reaching the tail. Moving it onto the durable
 * queue keeps the cron O(1) per user (a bulk enqueue) and lets the work drain,
 * bounded, across many worker/drain invocations.
 *
 * Everything here is idempotent and collapse-safe: the enqueue helpers dedupe on
 * PENDING jobs, and the digest is guarded by both a deduped enqueue and the
 * EmailDigest unique claim — so a re-run of the maintenance job is harmless.
 *
 * Org-scoped work (alert scan, notify, embed/draft backfill, digest) is keyed on
 * the integration's organization; the safety sync + watch renewal stay keyed on
 * the connector mailbox.
 */

// Renew push watches that expire within this window.
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000

export interface MaintenanceResult {
  synced: boolean
  embedsQueued: number
  draftsQueued: number
  renewed: boolean
  digestQueued: boolean
  errors: string[]
}

export async function runGmailMaintenance(userId: string): Promise<MaintenanceResult> {
  const result: MaintenanceResult = {
    synced: false,
    embedsQueued: 0,
    draftsQueued: 0,
    renewed: false,
    digestQueued: false,
    errors: [],
  }

  const integration = await prisma.integration.findFirst({
    where: { userId, type: 'GMAIL', isActive: true },
  })
  if (!integration) {
    // Disconnected between enqueue and run — nothing to do.
    return result
  }
  const organizationId = integration.organizationId

  const aiOn = Boolean(getTextProvider())
  const pubsubConfigured = Boolean(process.env.GMAIL_PUBSUB_TOPIC)
  const now = new Date()
  const isMonday = now.getUTCDay() === 1

  // 1. Safety sync — covers any push notification we missed. Calendar rides
  //    the same tick (the sync job itself no-ops without the calendar scope).
  try {
    await enqueueGmailSync(userId)
    await enqueueCalendarSync(userId)
    result.synced = true
  } catch (e) {
    result.errors.push(`sync: ${String(e)}`)
  }

  // 2. Alert scan + a notify backstop (due reminders must surface daily even
  //    when no alert changed; notifyNewAlerts no-ops cheaply when idle).
  if (organizationId) {
    try {
      await enqueueScanRiskAlerts(organizationId)
      await enqueueNotifyAlerts(organizationId)
    } catch (e) {
      result.errors.push(`alert-scan: ${String(e)}`)
    }
  }

  // 3. Embedding backfill — bounded; skipped while a previous batch is pending.
  if (organizationId) {
    try {
      const missing = await findUnembeddedConversationIds(organizationId, 50)
      if (missing.length) {
        const pending = await prisma.job.count({ where: { type: 'EMBED_CONVERSATION', status: 'PENDING' } })
        if (pending === 0) {
          result.embedsQueued += await enqueueMany(
            'EMBED_CONVERSATION',
            missing.map((conversationId) => ({ conversationId })),
            {},
            (p) => `EMBED_CONVERSATION:${p.conversationId}`,
          )
        }
      }
    } catch (e) {
      result.errors.push(`embed-backfill: ${String(e)}`)
    }
  }

  // 4. Auto-draft backfill — urgent awaiting threads that never got a draft.
  if (aiOn && organizationId) {
    try {
      const pendingDrafts = await prisma.job.count({ where: { type: 'GENERATE_DRAFT', status: 'PENDING' } })
      if (pendingDrafts === 0) {
        const candidates = await prisma.conversation.findMany({
          where: {
            organizationId,
            integration: { isActive: true },
            awaitingReply: true,
            priority: { in: ['HOT', 'ATTENTION'] },
            draft: { is: null },
          },
          select: { id: true },
          orderBy: { priorityScore: 'desc' },
          take: 20,
        })
        if (candidates.length) {
          result.draftsQueued += await enqueueMany(
            'GENERATE_DRAFT',
            candidates.map((c) => ({ conversationId: c.id })),
            {},
            (p) => `GENERATE_DRAFT:${p.conversationId}`,
          )
        }
      }
    } catch (e) {
      result.errors.push(`draft-backfill: ${String(e)}`)
    }
  }

  // 5. Weekly digest — per organization, Mondays (UTC). Deduped by org+week; the
  //    digest service's EmailDigest claim is the real idempotency guard.
  if (isMonday && organizationId) {
    try {
      const weekKey = isoWeekKey(now)
      const periodKey = `${weekKey}:${organizationId}`
      await enqueueDeduped(
        'SEND_WEEKLY_DIGEST',
        { organizationId, periodKey },
        `SEND_WEEKLY_DIGEST:${organizationId}:${weekKey}`,
      )
      result.digestQueued = true
    } catch (e) {
      result.errors.push(`digest: ${String(e)}`)
    }
  }

  // 6. Renew the push watch if missing/expiring (only when Pub/Sub is wired up).
  if (pubsubConfigured) {
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {}
    const expRaw = meta.watchExpiration
    const expiresAt = typeof expRaw === 'string' ? parseInt(expRaw, 10) : 0
    const needsRenew = !expiresAt || expiresAt - Date.now() < RENEW_BEFORE_MS
    if (needsRenew) {
      try {
        await startGmailWatch(integration)
        result.renewed = true
      } catch (e) {
        result.errors.push(`watch: ${String(e)}`)
      }
    }
  }

  return result
}
