import type { Job } from '@prisma/client'
import { syncGmailForUser } from '@/services/gmail.service'
import { analyzeConversation } from '@/services/conversation.analyzer'
import { embedConversation } from '@/services/embedding.service'
import { scanRiskAlerts } from '@/services/alert.service'
import { sendWeeklyDigest } from '@/services/digest.service'
import { upsertAutoDraft } from '@/services/draft.service'
import { notifyNewAlerts } from '@/services/notification.service'
import { runGmailMaintenance } from '@/services/maintenance.service'
import { getTextProvider } from '@/services/ai'
import {
  enqueueEmbedConversation,
  enqueueGenerateDraft,
  enqueueMany,
  enqueueNotifyAlerts,
  enqueueScanRiskAlerts,
} from './queue'

/**
 * Executes a single job by type. Returns a JSON-serialisable result that is
 * stored on the job row (and surfaced to the UI for GMAIL_SYNC). Throwing here
 * marks the job for retry/backoff via the runner.
 */
export async function handleJob(job: Job): Promise<unknown> {
  const payload = (job.payload ?? {}) as Record<string, unknown>

  switch (job.type) {
    case 'GMAIL_SYNC': {
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('GMAIL_SYNC job missing userId')

      const result = await syncGmailForUser(userId)

      // Auto-analyze: queue an analysis job per conversation with new inbound
      // messages. De-duplicated, and inserted in ONE round trip — a per-job
      // create loop added ~100 sequential queries to the initial import.
      const changed = Array.from(new Set(result.changedConversationIds ?? []))
      await enqueueMany(
        'ANALYZE_CONVERSATION',
        changed.map((conversationId) => ({ conversationId })),
        { userId },
        (p) => `ANALYZE_CONVERSATION:${p.conversationId}`,
      )

      // Embeddings for the same changed threads (claimNext is FIFO on
      // createdAt, so these run after the analyses queued above), then one
      // alert scan over the refreshed workspace.
      await enqueueMany(
        'EMBED_CONVERSATION',
        changed.map((conversationId) => ({ conversationId })),
        { userId },
        (p) => `EMBED_CONVERSATION:${p.conversationId}`,
      )
      await enqueueScanRiskAlerts(userId)

      return {
        synced: result.synced,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
        queuedAnalyses: changed.length,
      }
    }

    case 'ANALYZE_CONVERSATION': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('ANALYZE_CONVERSATION job missing conversationId')
      // On the final attempt, accept the labelled local "quick scan" instead of
      // parking the job FAILED — covers exhausted daily quotas gracefully.
      const lastAttempt = job.attempts >= job.maxAttempts
      const { priority } = await analyzeConversation(conversationId, { fallbackOnRetryable: lastAttempt })
      // The fresh summary changes the embedding text — refresh it (hash-deduped).
      if (job.userId) await enqueueEmbedConversation(job.userId, conversationId)
      // Pre-draft a reply for urgent threads (gated on priority here; the job
      // re-checks awaiting + provider). Skipped entirely without an AI key.
      if (job.userId && (priority.level === 'HOT' || priority.level === 'ATTENTION') && getTextProvider()) {
        await enqueueGenerateDraft(job.userId, conversationId)
      }
      return { conversationId, priority: priority.level, score: priority.score }
    }

    case 'EMBED_CONVERSATION': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('EMBED_CONVERSATION job missing conversationId')
      return await embedConversation(conversationId)
    }

    case 'SCAN_RISK_ALERTS': {
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('SCAN_RISK_ALERTS job missing userId')
      const result = await scanRiskAlerts(userId)
      // New/reopened alerts may include urgent ones worth an email. The
      // notifier itself filters to CRITICAL/HIGH + not-yet-notified + throttle,
      // so enqueuing on any change is cheap and keeps the policy in one place.
      if (result.created + result.reopened > 0) await enqueueNotifyAlerts(userId)
      return result
    }

    case 'NOTIFY_ALERTS': {
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('NOTIFY_ALERTS job missing userId')
      return await notifyNewAlerts(userId)
    }

    case 'SEND_WEEKLY_DIGEST': {
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('SEND_WEEKLY_DIGEST job missing userId')
      const periodKey = typeof payload.periodKey === 'string' ? payload.periodKey : undefined
      return await sendWeeklyDigest(userId, { periodKey })
    }

    case 'GENERATE_DRAFT': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('GENERATE_DRAFT job missing conversationId')
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('GENERATE_DRAFT job missing userId')
      return await upsertAutoDraft(userId, conversationId)
    }

    case 'GMAIL_MAINTENANCE': {
      const userId = String(payload.userId ?? job.userId ?? '')
      if (!userId) throw new Error('GMAIL_MAINTENANCE job missing userId')
      return await runGmailMaintenance(userId)
    }

    default: {
      // Exhaustiveness guard for future job types.
      throw new Error(`Unknown job type: ${job.type}`)
    }
  }
}
