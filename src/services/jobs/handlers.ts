import type { Job } from '@prisma/client'
import { syncGmailForUser } from '@/services/gmail.service'
import { analyzeConversation } from '@/services/conversation.analyzer'
import { enqueueMany } from './queue'

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
      await enqueueMany('ANALYZE_CONVERSATION', changed.map((conversationId) => ({ conversationId })), { userId })

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
      const { priority } = await analyzeConversation(conversationId)
      return { conversationId, priority: priority.level, score: priority.score }
    }

    default: {
      // Exhaustiveness guard for future job types.
      throw new Error(`Unknown job type: ${job.type}`)
    }
  }
}
