import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeCron } from '@/lib/cron'
import { enqueue, enqueueGmailSync, enqueueScanRiskAlerts, enqueueMany } from '@/services/jobs/queue'
import { integrationEmail, startGmailWatch } from '@/services/gmail.service'
import { findUnembeddedConversationIds } from '@/services/embedding.service'
import { digestOwnerEmail, isoWeekKey } from '@/services/digest.service'
import { getTextProvider } from '@/services/ai'
import { kickJobQueue } from '@/services/jobs/kick'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Renew watches that expire within this window.
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000

/**
 * Periodic Gmail + workspace maintenance (Vercel Cron, daily). For each active
 * Gmail integration:
 *   1. Enqueue a safety incremental sync (covers any push notification we missed).
 *   2. Renew the push watch if it's missing or expiring within 24h.
 *   3. Enqueue a risk-alert scan (also runs after every sync — this is the backstop).
 *   4. Backfill missing conversation embeddings (bounded batch).
 *   5. On Mondays (UTC): enqueue the weekly digest for the GMAIL_USER_EMAIL
 *      owner — deduped by (userId, ISO week), so reruns never double-send.
 *
 * Push notifications handle real-time; this is the durability backstop.
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integrations = await prisma.integration.findMany({
    where: { type: 'GMAIL', isActive: true },
  })

  const pubsubConfigured = Boolean(process.env.GMAIL_PUBSUB_TOPIC)
  const ownerEmail = digestOwnerEmail()
  const isMonday = new Date().getUTCDay() === 1
  const periodKey = isoWeekKey(new Date())

  let queued = 0
  let renewed = 0
  let digestsQueued = 0
  let embedsQueued = 0
  let draftsQueued = 0
  const errors: string[] = []
  const aiOn = Boolean(getTextProvider())

  for (const integration of integrations) {
    try {
      await enqueueGmailSync(integration.userId)
      queued++
    } catch (e) {
      errors.push(`sync ${integration.id}: ${String(e)}`)
    }

    try {
      await enqueueScanRiskAlerts(integration.userId)
    } catch (e) {
      errors.push(`alert-scan ${integration.id}: ${String(e)}`)
    }

    // Embedding backfill — covers threads imported before semantic search
    // existed (or while the AI key was missing). Bounded; hash-idempotent.
    try {
      const missing = await findUnembeddedConversationIds(integration.userId, 50)
      if (missing.length) {
        const pending = await prisma.job.count({
          where: { type: 'EMBED_CONVERSATION', userId: integration.userId, status: 'PENDING' },
        })
        if (pending === 0) {
          embedsQueued += await enqueueMany(
            'EMBED_CONVERSATION',
            missing.map((conversationId) => ({ conversationId })),
            { userId: integration.userId },
          )
        }
      }
    } catch (e) {
      errors.push(`embed-backfill ${integration.id}: ${String(e)}`)
    }

    // Auto-draft backfill — urgent awaiting threads that never got a draft.
    // Bounded; skipped without an AI key or while draft jobs are still pending.
    if (aiOn) {
      try {
        const pendingDrafts = await prisma.job.count({
          where: { type: 'GENERATE_DRAFT', userId: integration.userId, status: 'PENDING' },
        })
        if (pendingDrafts === 0) {
          const candidates = await prisma.conversation.findMany({
            where: {
              userId: integration.userId,
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
            draftsQueued += await enqueueMany(
              'GENERATE_DRAFT',
              candidates.map((c) => ({ conversationId: c.id })),
              { userId: integration.userId },
            )
          }
        }
      } catch (e) {
        errors.push(`draft-backfill ${integration.id}: ${String(e)}`)
      }
    }

    // Weekly digest — only for the owner mailbox (GMAIL_USER_EMAIL identity).
    if (isMonday && ownerEmail && integrationEmail(integration) === ownerEmail) {
      try {
        const alreadySent = await prisma.emailDigest.findUnique({
          where: { userId_periodKey: { userId: integration.userId, periodKey } },
          select: { id: true },
        })
        const alreadyQueued = alreadySent
          ? 1
          : await prisma.job.count({
              where: { type: 'SEND_WEEKLY_DIGEST', userId: integration.userId, status: { in: ['PENDING', 'RUNNING'] } },
            })
        if (!alreadySent && alreadyQueued === 0) {
          await enqueue('SEND_WEEKLY_DIGEST', { userId: integration.userId, periodKey }, { userId: integration.userId })
          digestsQueued++
        }
      } catch (e) {
        errors.push(`digest ${integration.id}: ${String(e)}`)
      }
    }

    if (!pubsubConfigured) continue

    const meta = (integration.metadata as Record<string, unknown> | null) ?? {}
    const expRaw = meta.watchExpiration
    const expiresAt = typeof expRaw === 'string' ? parseInt(expRaw, 10) : 0
    const needsRenew = !expiresAt || expiresAt - Date.now() < RENEW_BEFORE_MS

    if (needsRenew) {
      try {
        await startGmailWatch(integration)
        renewed++
      } catch (e) {
        errors.push(`watch ${integration.id}: ${String(e)}`)
      }
    }
  }

  // Drain what we just enqueued in this same invocation (post-response), so a
  // single external-cron ping runs the whole pipeline — sync → analyze →
  // embed → alert scan → digest — without waiting for the separate
  // /api/jobs/process tick. Bounded by maxDuration; anything left over is
  // mopped up by /api/jobs/process. Safe to overlap: claimNext() uses
  // SELECT … FOR UPDATE SKIP LOCKED.
  kickJobQueue()

  return NextResponse.json({
    integrations: integrations.length,
    queued,
    renewed,
    digestsQueued,
    embedsQueued,
    draftsQueued,
    errors,
  })
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
