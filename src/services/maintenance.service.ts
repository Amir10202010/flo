import { prisma } from '@/lib/prisma'
import { enqueue, enqueueGmailSync, enqueueScanRiskAlerts, enqueueNotifyAlerts, enqueueMany } from './jobs/queue'
import { integrationEmail, startGmailWatch } from './gmail.service'
import { findUnembeddedConversationIds } from './embedding.service'
import { digestOwnerEmail, isoWeekKey } from './digest.service'
import { getTextProvider } from './ai'

/**
 * Per-user daily maintenance, run from the GMAIL_MAINTENANCE job (one per active
 * integration). This used to live inline in /api/cron/gmail's per-integration
 * loop, which made a single cron invocation O(N integrations) — at scale it
 * timed out before reaching the tail. Moving it onto the durable queue keeps the
 * cron O(1) per user (a bulk enqueue) and lets the work drain, bounded, across
 * many worker/drain invocations.
 *
 * Everything here is idempotent and collapse-safe: the enqueue helpers dedupe on
 * PENDING jobs, and the digest is guarded by both a job-count check and the
 * EmailDigest unique claim — so a re-run of the maintenance job is harmless.
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

  const aiOn = Boolean(getTextProvider())
  const pubsubConfigured = Boolean(process.env.GMAIL_PUBSUB_TOPIC)
  const ownerEmail = digestOwnerEmail()
  const now = new Date()
  const isMonday = now.getUTCDay() === 1
  const periodKey = isoWeekKey(now)

  // 1. Safety sync — covers any push notification we missed.
  try {
    await enqueueGmailSync(userId)
    result.synced = true
  } catch (e) {
    result.errors.push(`sync: ${String(e)}`)
  }

  // 2. Alert scan + a notify backstop (due reminders must surface daily even
  //    when no alert changed; notifyNewAlerts no-ops cheaply when idle).
  try {
    await enqueueScanRiskAlerts(userId)
    await enqueueNotifyAlerts(userId)
  } catch (e) {
    result.errors.push(`alert-scan: ${String(e)}`)
  }

  // 3. Embedding backfill — bounded; skipped while a previous batch is pending.
  try {
    const missing = await findUnembeddedConversationIds(userId, 50)
    if (missing.length) {
      const pending = await prisma.job.count({
        where: { type: 'EMBED_CONVERSATION', userId, status: 'PENDING' },
      })
      if (pending === 0) {
        result.embedsQueued += await enqueueMany(
          'EMBED_CONVERSATION',
          missing.map((conversationId) => ({ conversationId })),
          { userId },
          (p) => `EMBED_CONVERSATION:${p.conversationId}`,
        )
      }
    }
  } catch (e) {
    result.errors.push(`embed-backfill: ${String(e)}`)
  }

  // 4. Auto-draft backfill — urgent awaiting threads that never got a draft.
  if (aiOn) {
    try {
      const pendingDrafts = await prisma.job.count({
        where: { type: 'GENERATE_DRAFT', userId, status: 'PENDING' },
      })
      if (pendingDrafts === 0) {
        const candidates = await prisma.conversation.findMany({
          where: {
            userId,
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
            { userId },
            (p) => `GENERATE_DRAFT:${p.conversationId}`,
          )
        }
      }
    } catch (e) {
      result.errors.push(`draft-backfill: ${String(e)}`)
    }
  }

  // 5. Weekly digest — only for the owner mailbox (GMAIL_USER_EMAIL identity),
  //    Mondays (UTC). Deduped by (userId, ISO week) + the EmailDigest claim.
  if (isMonday && ownerEmail && integrationEmail(integration) === ownerEmail) {
    try {
      const alreadySent = await prisma.emailDigest.findUnique({
        where: { userId_periodKey: { userId, periodKey } },
        select: { id: true },
      })
      const alreadyQueued = alreadySent
        ? 1
        : await prisma.job.count({
            where: { type: 'SEND_WEEKLY_DIGEST', userId, status: { in: ['PENDING', 'RUNNING'] } },
          })
      if (!alreadySent && alreadyQueued === 0) {
        await enqueue('SEND_WEEKLY_DIGEST', { userId, periodKey }, { userId })
        result.digestQueued = true
      }
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
