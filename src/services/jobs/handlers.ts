import type { Job } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { syncGmailForUser } from '@/services/gmail.service'
import { analyzeConversation } from '@/services/conversation.analyzer'
import { embedConversation } from '@/services/embedding.service'
import { scanRiskAlerts } from '@/services/alert.service'
import { sendWeeklyDigest } from '@/services/digest.service'
import { upsertAutoDraft } from '@/services/draft.service'
import { notifyNewAlerts } from '@/services/notification.service'
import { runGmailMaintenance } from '@/services/maintenance.service'
import { applyRulesToConversation } from '@/services/rule.service'
import { extractGraphEntities } from '@/services/knowledge.extract'
import { getTextProvider } from '@/services/ai'
import {
  enqueueEmbedConversation,
  enqueueExtractGraphEntities,
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
      // Org-scoped alert scan over the refreshed shared workspace.
      const syncInteg = await prisma.integration.findFirst({
        where: { userId, type: 'GMAIL' },
        select: { organizationId: true },
      })
      if (syncInteg?.organizationId) {
        await enqueueScanRiskAlerts(syncInteg.organizationId)
        // Routing/automation rules over the changed threads (skipped entirely
        // when the org has no active rules — bounded so a big import stays cheap).
        const ruleCount = await prisma.rule.count({ where: { organizationId: syncInteg.organizationId, isActive: true } })
        if (ruleCount > 0) {
          for (const cid of changed.slice(0, 200)) {
            await applyRulesToConversation(syncInteg.organizationId, cid)
          }
        }
      }

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
      await enqueueEmbedConversation(conversationId)
      // Knowledge-graph extraction: deterministic company edge always, AI topics
      // when a provider is configured (the job itself skips the AI half otherwise).
      await enqueueExtractGraphEntities(conversationId)
      // Pre-draft a reply for urgent threads (gated on priority here; the job
      // re-checks awaiting + provider). Skipped entirely without an AI key.
      if ((priority.level === 'HOT' || priority.level === 'ATTENTION') && getTextProvider()) {
        await enqueueGenerateDraft(conversationId)
      }
      return { conversationId, priority: priority.level, score: priority.score }
    }

    case 'EMBED_CONVERSATION': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('EMBED_CONVERSATION job missing conversationId')
      return await embedConversation(conversationId)
    }

    case 'SCAN_RISK_ALERTS': {
      const organizationId = String(payload.organizationId ?? '')
      if (!organizationId) throw new Error('SCAN_RISK_ALERTS job missing organizationId')
      const result = await scanRiskAlerts(organizationId)
      // New/reopened alerts may include urgent ones worth an email. The
      // notifier itself filters to CRITICAL/HIGH + not-yet-notified + throttle,
      // so enqueuing on any change is cheap and keeps the policy in one place.
      if (result.created + result.reopened > 0) await enqueueNotifyAlerts(organizationId)
      return result
    }

    case 'NOTIFY_ALERTS': {
      const organizationId = String(payload.organizationId ?? '')
      if (!organizationId) throw new Error('NOTIFY_ALERTS job missing organizationId')
      return await notifyNewAlerts(organizationId)
    }

    case 'SEND_WEEKLY_DIGEST': {
      const organizationId = String(payload.organizationId ?? '')
      if (!organizationId) throw new Error('SEND_WEEKLY_DIGEST job missing organizationId')
      const periodKey = typeof payload.periodKey === 'string' ? payload.periodKey : undefined
      return await sendWeeklyDigest(organizationId, { periodKey })
    }

    case 'GENERATE_DRAFT': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('GENERATE_DRAFT job missing conversationId')
      return await upsertAutoDraft(conversationId)
    }

    case 'EXTRACT_GRAPH_ENTITIES': {
      const conversationId = String(payload.conversationId ?? '')
      if (!conversationId) throw new Error('EXTRACT_GRAPH_ENTITIES job missing conversationId')
      // On the final attempt, accept the deterministic-only result instead of
      // parking the job FAILED — mirrors ANALYZE_CONVERSATION's quota-exhaustion
      // handling (retryable topic-extraction errors back off until then).
      const lastAttempt = job.attempts >= job.maxAttempts
      return await extractGraphEntities(conversationId, { fallbackOnRetryable: lastAttempt })
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
