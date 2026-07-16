import { google, gmail_v1 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { mergeIntegrationMetadata } from '@/lib/integration-metadata'
import { htmlToText } from '@/lib/html'
import { stripInlineDataImages, rewriteCidImages, normalizeCid, type CidMap } from '@/lib/email-inline'
import { classifyEmail, type ClassifierRule } from '@/services/email.classifier'
import { markDraftSent } from '@/services/draft.service'
import type { SyncResult } from '@/types'
import type { EmailCategory, Integration } from '@prisma/client'

// How many threads to fetch from Google in parallel. Network-only: DB writes
// happen sequentially afterwards so we never demand more than one pooled
// connection per sync (see persistThread).
const THREAD_CONCURRENCY = 6
// Cap on threads pulled in a single full sync (first connect / history expiry).
// Matches the inbox display cap (take: 100 in InboxListContent).
const FULL_SYNC_LIMIT = 100

type GmailClient = gmail_v1.Gmail
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>

function buildOAuth2Client(integration: Integration): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials({
    access_token: decryptSecret(integration.accessToken),
    refresh_token: integration.refreshToken ? decryptSecret(integration.refreshToken) : undefined,
  })
  // Persist refreshed tokens (re-encrypted) automatically. Google occasionally
  // rotates the refresh token too — losing it would force a manual reconnect.
  client.on('tokens', (newTokens) => {
    if (newTokens.access_token || newTokens.refresh_token) {
      prisma.integration
        .update({
          where: { id: integration.id },
          data: {
            ...(newTokens.access_token ? { accessToken: encryptSecret(newTokens.access_token) } : {}),
            ...(newTokens.refresh_token ? { refreshToken: encryptSecret(newTokens.refresh_token) } : {}),
          },
        })
        .catch((e) => console.error('[gmail] failed to persist refreshed tokens:', e))
    }
  })
  return client
}

function gmailFor(integration: Integration): GmailClient {
  return google.gmail({ version: 'v1', auth: buildOAuth2Client(integration) })
}

/** Authenticated OAuth2 client for other Google APIs on the same connection
 *  (Calendar). Shares the token-refresh persistence above. */
export function oauthClientFor(integration: Integration): OAuth2Client {
  return buildOAuth2Client(integration)
}

/**
 * Fetch a single Gmail attachment's bytes on demand — backs the inline-image
 * proxy (`/api/attachments`). Returns the raw bytes, or null when Gmail has no
 * such attachment. Network only; nothing is persisted, so inline images never
 * grow the DB.
 */
export async function fetchGmailAttachment(
  integration: Integration,
  messageId: string,
  attachmentId: string,
): Promise<Buffer | null> {
  const gmail = gmailFor(integration)
  const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId })
  const data = res.data.data
  return data ? Buffer.from(data, 'base64url') : null
}

/** Run `fn` over `items` with bounded concurrency. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Recursively collect both bodies: a clean plain-text `content` (used by
 * analysis/search/embeddings/preview) and the raw `html` when the message had a
 * text/html part (rendered richly in the inbox, stored separately so HTML never
 * pollutes the text pipelines).
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  content: string
  html: string | null
  /** Inline attachments (Content-ID → attachmentId) referenced by `cid:` images. */
  inlineAttachments: CidMap
} {
  const found = { text: '', html: '' }
  const inlineAttachments: CidMap = new Map()

  function walk(part: gmail_v1.Schema$MessagePart | undefined) {
    if (!part) return
    const mime = part.mimeType ?? ''
    const data = part.body?.data
    if (data && (mime === 'text/plain' || mime === 'text/html')) {
      let decoded = ''
      try {
        decoded = Buffer.from(data, 'base64').toString('utf-8')
      } catch {
        decoded = ''
      }
      if (mime === 'text/plain' && !found.text) found.text = decoded
      if (mime === 'text/html' && !found.html) found.html = decoded
    }
    // An inline image carried as a separate MIME part: map its Content-ID to the
    // Gmail attachmentId so `cid:` refs can be rewritten to the on-demand proxy.
    const attachmentId = part.body?.attachmentId
    if (attachmentId) {
      const cid = headerValue(part.headers, 'Content-ID')
      if (cid) {
        const key = normalizeCid(cid)
        if (key && !inlineAttachments.has(key)) inlineAttachments.set(key, attachmentId)
      }
    }
    part.parts?.forEach(walk)
  }

  walk(payload)
  const html = found.html.trim() ? found.html : null
  const content = found.text.trim() ? found.text : html ? htmlToText(html) : ''
  return { content, html, inlineAttachments }
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export function integrationEmail(integration: Integration): string {
  // Prefer the denormalized column; fall back to metadata for rows written
  // before the column existed (until the one-time backfill UPDATE runs).
  const meta = integration.metadata as { email?: string } | null
  return (integration.email ?? meta?.email ?? process.env.GMAIL_USER_EMAIL ?? '').toLowerCase()
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Best-effort HTTP status extraction across gaxios versions (status, code, response.status). */
function httpStatus(err: unknown): number | undefined {
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } }
  for (const v of [e?.status, e?.response?.status, e?.code]) {
    const n = typeof v === 'string' ? parseInt(v, 10) : v
    if (typeof n === 'number' && Number.isFinite(n)) return n
  }
  return undefined
}

type FetchedThread = { threadId: string; thread: gmail_v1.Schema$Thread | null; error?: string }

/** Fetch thread payloads from Gmail with bounded concurrency (network only — no DB). */
async function fetchThreads(gmail: GmailClient, threadIds: string[]): Promise<FetchedThread[]> {
  return mapPool(threadIds, THREAD_CONCURRENCY, async (threadId) => {
    try {
      const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
      return { threadId, thread: res.data }
    } catch (err) {
      return { threadId, thread: null, error: `Thread ${threadId}: ${errMessage(err)}` }
    }
  })
}

type ParsedMessage = {
  externalId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  html: string | null
  sentAt: Date
}

type ParsedThread = {
  threadId: string
  subject: string
  contactEmail: string
  contactName: string
  lastMessageAt: Date
  messages: ParsedMessage[]
  /** Union of Gmail labelIds across the thread (CATEGORY_*, SPAM, …). */
  labels: string[]
  /** Any message carried a List-Unsubscribe header (bulk-mail signal). */
  hasListUnsubscribe: boolean
}

/** Extract everything we persist from a raw Gmail thread. Pure — no I/O. */
function parseThread(
  integration: Integration,
  threadId: string,
  thread: gmail_v1.Schema$Thread,
): ParsedThread | null {
  const messages = (thread.messages ?? []).slice(-20)
  if (!messages.length) return null

  const accountEmail = integrationEmail(integration)
  const subject = headerValue(messages[0].payload?.headers, 'Subject') || '(no subject)'

  // Contact identity: prefer the first INBOUND sender so threads the user
  // started don't create a contact for the user's own address.
  const identityMsg =
    messages.find((m) => {
      const f = headerValue(m.payload?.headers, 'From').toLowerCase()
      return accountEmail ? !f.includes(accountEmail) : true
    }) ?? messages[0]
  const from = headerValue(identityMsg.payload?.headers, 'From')

  const emailMatch = from.match(/<(.+?)>/)
  const email = (emailMatch?.[1]?.trim() ?? from.trim()).toLowerCase()
  const name = from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim() || email

  const parsedMessages: ParsedMessage[] = []
  const labels = new Set<string>()
  let hasListUnsubscribe = false
  for (const msg of messages) {
    if (!msg.id) continue
    for (const l of msg.labelIds ?? []) labels.add(l)
    if (headerValue(msg.payload?.headers, 'List-Unsubscribe')) hasListUnsubscribe = true
    const msgFrom = headerValue(msg.payload?.headers, 'from').toLowerCase()
    const isOutbound = accountEmail ? msgFrom.includes(accountEmail) : false
    const body = extractBody(msg.payload)
    // Keep base64 blobs out of the DB and point inline `cid:` images at the
    // on-demand proxy — BEFORE the 200 KB cap, so we keep real markup instead of
    // a truncated base64 string.
    let html = body.html
    if (html) {
      html = stripInlineDataImages(html).html
      html = rewriteCidImages(html, msg.id, body.inlineAttachments)
      html = html.slice(0, 200_000)
    }
    parsedMessages.push({
      externalId: msg.id,
      direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
      content: body.content.slice(0, 5000) || '(no text content)',
      html: html || null,
      sentAt: new Date(parseInt(msg.internalDate ?? '0')),
    })
  }
  if (!parsedMessages.length) return null

  return {
    threadId,
    subject,
    contactEmail: email,
    contactName: name,
    lastMessageAt: new Date(parseInt(messages[messages.length - 1].internalDate ?? '0')),
    messages: parsedMessages,
    labels: Array.from(labels),
    hasListUnsubscribe,
  }
}

/**
 * Persist all parsed threads with a fixed, small number of set-based queries
 * (createMany / findMany ... IN) instead of ~5 round trips per thread. The
 * initial 100-thread import previously issued ~500 sequential queries through
 * the Supabase pooler (2+ minutes — longer than serverless budgets and the UI
 * poll window, so the invocation got killed mid-job); this does it in <10
 * queries. All writes stay idempotent (skipDuplicates + unique constraints),
 * so overlapping syncs and retries remain safe.
 */
async function persistThreads(
  userId: string,
  integration: Integration,
  threads: ParsedThread[],
  result: SyncResult,
): Promise<void> {
  if (!threads.length) return
  try {
    // 1. Contacts: one bulk insert + one lookup. Existing contacts keep their
    //    stored name (skipDuplicates leaves them untouched).
    const nameByEmail = new Map<string, string>()
    for (const t of threads) {
      if (!nameByEmail.has(t.contactEmail)) nameByEmail.set(t.contactEmail, t.contactName)
    }
    await prisma.contact.createMany({
      data: Array.from(nameByEmail, ([email, name]) => ({
        userId,
        organizationId: integration.organizationId,
        email,
        name,
        source: 'GMAIL' as const,
      })),
      skipDuplicates: true,
    })
    const contacts = await prisma.contact.findMany({
      where: { userId, email: { in: Array.from(nameByEmail.keys()) } },
      select: { id: true, email: true },
    })
    const contactIdByEmail = new Map(contacts.map((c) => [c.email, c.id]))

    const persistable = threads.filter((t) => contactIdByEmail.has(t.contactEmail))
    for (const t of threads) {
      if (!contactIdByEmail.has(t.contactEmail)) {
        result.errors.push(`Thread ${t.threadId}: could not resolve contact ${t.contactEmail || '(empty sender)'}`)
      }
    }
    if (!persistable.length) return

    // 2. Conversations: diff against existing rows, bulk-create the new ones,
    //    then bump lastMessageAt only where the thread actually has newer mail
    //    (a handful of rows on incremental syncs).
    const threadIds = persistable.map((t) => t.threadId)
    const existing = await prisma.conversation.findMany({
      where: { integrationId: integration.id, externalId: { in: threadIds } },
      select: { externalId: true, lastMessageAt: true },
    })
    const existingByThread = new Map(existing.map((c) => [c.externalId, c]))

    const newThreads = persistable.filter((t) => !existingByThread.has(t.threadId))
    if (newThreads.length) {
      // Rule-based categorisation runs at ingestion so every thread lands in the
      // right bucket immediately — no AI required. Learned/custom rules win.
      const rules: ClassifierRule[] = await prisma.categoryRule.findMany({
        where: { userId },
        select: { matchType: true, value: true, category: true },
      })
      await prisma.conversation.createMany({
        data: newThreads.map((t) => {
          const firstInbound = t.messages.find((m) => m.direction === 'INBOUND') ?? t.messages[0]
          const verdict = classifyEmail(
            {
              senderEmail: t.contactEmail,
              senderName: t.contactName,
              subject: t.subject,
              body: firstInbound?.content ?? '',
              gmailLabels: t.labels,
              hasListUnsubscribe: t.hasListUnsubscribe,
              hasUserReplied: t.messages.some((m) => m.direction === 'OUTBOUND'),
            },
            rules,
          )
          return {
            userId,
            organizationId: integration.organizationId,
            inboxId: integration.inboxId,
            contactId: contactIdByEmail.get(t.contactEmail)!,
            integrationId: integration.id,
            channel: 'GMAIL' as const,
            externalId: t.threadId,
            subject: t.subject,
            lastMessageAt: t.lastMessageAt,
            awaitingReply: t.messages[t.messages.length - 1]?.direction === 'INBOUND',
            category: verdict.category as EmailCategory,
            categorySource: verdict.source,
            categoryConfidence: verdict.confidence,
          }
        }),
        skipDuplicates: true, // a concurrent sync may have created some meanwhile
      })
    }

    // Resolve ids for ALL conversations (including the just-created ones).
    const allConvs = await prisma.conversation.findMany({
      where: { integrationId: integration.id, externalId: { in: threadIds } },
      select: { id: true, externalId: true },
    })
    const convIdByThread = new Map(allConvs.map((c) => [c.externalId, c.id]))

    const toBump = persistable.filter((t) => {
      const ex = existingByThread.get(t.threadId)
      return ex && (!ex.lastMessageAt || t.lastMessageAt > ex.lastMessageAt) && convIdByThread.has(t.threadId)
    })
    for (const t of toBump) {
      await prisma.conversation.update({
        where: { id: convIdByThread.get(t.threadId)! },
        data: {
          lastMessageAt: t.lastMessageAt,
          awaitingReply: t.messages[t.messages.length - 1]?.direction === 'INBOUND',
        },
      })
    }

    // 3. Messages: one lookup over (conversationId, externalId) pairs, then one
    //    bulk insert for the genuinely new rows.
    const candidates: (ParsedMessage & { conversationId: string })[] = []
    for (const t of persistable) {
      const convId = convIdByThread.get(t.threadId)
      if (!convId) {
        result.errors.push(`Thread ${t.threadId}: conversation row missing after insert`)
        continue
      }
      for (const m of t.messages) candidates.push({ ...m, conversationId: convId })
    }
    const existingMsgs = candidates.length
      ? await prisma.message.findMany({
          where: {
            conversationId: { in: Array.from(new Set(candidates.map((c) => c.conversationId))) },
            externalId: { in: candidates.map((c) => c.externalId) },
          },
          select: { conversationId: true, externalId: true },
        })
      : []
    const seen = new Set(existingMsgs.map((m) => `${m.conversationId}:${m.externalId}`))
    const toCreate = candidates.filter((c) => !seen.has(`${c.conversationId}:${c.externalId}`))
    if (toCreate.length) {
      await prisma.message.createMany({
        data: toCreate.map((c) => ({
          conversationId: c.conversationId,
          externalId: c.externalId,
          direction: c.direction,
          content: c.content,
          contentHtml: c.html,
          contentType: c.html ? ('HTML' as const) : ('TEXT' as const),
          sentAt: c.sentAt,
        })),
        skipDuplicates: true,
      })
    }

    // New inbound mail ⇒ AI summary/priority is stale ⇒ re-analyze.
    const changed = new Set(toCreate.filter((c) => c.direction === 'INBOUND').map((c) => c.conversationId))
    result.changedConversationIds!.push(...changed)

    result.synced += persistable.length
    result.created += newThreads.length
    result.updated += persistable.length - newThreads.length
  } catch (err) {
    result.errors.push(`Failed to persist threads: ${errMessage(err)}`)
  }
}

/** Collect changed thread IDs since `startHistoryId`. Returns null if history is unusable. */
async function changedThreadIds(gmail: GmailClient, startHistoryId: string): Promise<string[] | null> {
  const ids = new Set<string>()
  let pageToken: string | undefined
  try {
    do {
      const res = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
        pageToken,
      })
      for (const h of res.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          const tid = added.message?.threadId
          if (tid) ids.add(tid)
        }
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return Array.from(ids)
  } catch (err) {
    // 404 => startHistoryId too old/expired, 400 => invalid cursor. Either way
    // the incremental path is unusable — signal the caller to do a bounded full
    // resync rather than failing the whole sync. (NB: gaxios exposes the HTTP
    // status as `err.status`, not `err.code` — see httpStatus().)
    console.warn(`[gmail] history.list failed (status ${httpStatus(err) ?? '?'}) — falling back to full sync:`, errMessage(err))
    return null
  }
}

/** List up to FULL_SYNC_LIMIT INBOX thread IDs (paginated). */
async function listInboxThreadIds(gmail: GmailClient): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const res = await gmail.users.threads.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: Math.min(100, FULL_SYNC_LIMIT - ids.length),
      pageToken,
    })
    for (const t of res.data.threads ?? []) {
      if (t.id) ids.push(t.id)
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken && ids.length < FULL_SYNC_LIMIT)
  return ids
}

export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: [], changedConversationIds: [] }

  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type: 'GMAIL' } },
  })
  if (!integration || !integration.isActive) {
    result.errors.push('Gmail integration not found or inactive')
    return result
  }

  const gmail = gmailFor(integration)
  const meta = (integration.metadata as Record<string, unknown> | null) ?? {}
  const lastHistoryId = typeof meta.lastHistoryId === 'string' ? meta.lastHistoryId : null

  // Capture the current history watermark up-front so we don't miss messages
  // that arrive mid-sync. If even this fails, auth/connectivity is broken and
  // nothing below can work — surface the error instead of failing opaquely.
  let newHistoryId: string | null = null
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    newHistoryId = profile.data.historyId ?? null
  } catch (err) {
    const status = httpStatus(err)
    result.errors.push(
      status === 401 || status === 403 || errMessage(err).includes('invalid_grant')
        ? `Gmail authorization failed (${errMessage(err)}) — disconnect and reconnect Gmail`
        : `Gmail API unreachable: ${errMessage(err)}`,
    )
    return result
  }

  let threadIds: string[] = []
  try {
    if (lastHistoryId) {
      // changedThreadIds returns null when the cursor is unusable → full resync.
      const changed = await changedThreadIds(gmail, lastHistoryId)
      threadIds = changed ?? (await listInboxThreadIds(gmail))
    } else {
      threadIds = await listInboxThreadIds(gmail)
    }
  } catch (err) {
    result.errors.push(`Failed to list Gmail threads: ${errMessage(err)}`)
    return result
  }

  // Fetch from Gmail concurrently (network only), parse in memory, then write
  // to the DB with a handful of set-based queries — the runtime pool is tiny
  // (see CLAUDE.md), so per-thread query fan-out causes P2024 timeouts, and
  // per-thread sequential queries made the initial import slower than the
  // serverless invocation budget.
  const fetched = await fetchThreads(gmail, threadIds)
  const parsed: ParsedThread[] = []
  for (const f of fetched) {
    if (!f.thread) {
      if (f.error) result.errors.push(f.error)
      continue
    }
    try {
      const p = parseThread(integration, f.threadId, f.thread)
      if (p) parsed.push(p)
    } catch (err) {
      result.errors.push(`Thread ${f.threadId}: ${errMessage(err)}`)
    }
  }
  await persistThreads(userId, integration, parsed, result)

  // Advance the history cursor only after a clean pass. On partial failure we
  // keep the old cursor so the next sync retries the missed threads (all
  // writes are idempotent); advancing past failures would silently drop them.
  const advanceCursor = result.errors.length === 0 && newHistoryId

  // Atomic metadata merge (jsonb ||) so a concurrent watch renewal / overlapping
  // sync can't clobber the cursor — and bump syncedAt in the same write.
  try {
    await mergeIntegrationMetadata(
      integration.id,
      advanceCursor ? { lastHistoryId: newHistoryId } : {},
      { touchSyncedAt: true },
    )
  } catch (err) {
    console.error('[gmail] failed to persist sync state (syncedAt/lastHistoryId):', err)
    result.errors.push(`Failed to persist sync state: ${errMessage(err)}`)
  }

  return result
}

export type ReclassifyResult = {
  scanned: number
  changed: number
  moves: Record<string, number>
  errors: string[]
}

/**
 * Re-run the rule classifier over already-synced Gmail threads, RE-FETCHING each
 * thread from Gmail so the full signal set (label ids + `List-Unsubscribe`) is
 * available — those headers aren't persisted, so a DB-only pass can't see them
 * and would wrongly demote newsletters/promos to Primary. This both applies the
 * latest heuristics and repairs categories that depend on bulk-mail signals.
 *
 * Only `rules`/legacy(null) rows are touched: manual moves and AI-refined
 * buckets are left intact. Idempotent — re-running re-derives the same verdict.
 */
export async function reclassifyGmailCategories(
  userId: string,
  onProgress?: (scanned: number, total: number, changed: number) => void,
): Promise<ReclassifyResult> {
  const out: ReclassifyResult = { scanned: 0, changed: 0, moves: {}, errors: [] }

  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId, type: 'GMAIL' } },
  })
  if (!integration || !integration.isActive) {
    out.errors.push('Gmail integration not found or inactive')
    return out
  }

  const rules: ClassifierRule[] = await prisma.categoryRule.findMany({
    where: { userId },
    select: { matchType: true, value: true, category: true },
  })

  // Only revisit rule/legacy rows — never clobber a manual move or an AI bucket.
  const convs = await prisma.conversation.findMany({
    where: {
      integrationId: integration.id,
      channel: 'GMAIL',
      OR: [{ categorySource: null }, { categorySource: 'rules' }],
    },
    select: { id: true, externalId: true, category: true, categorySource: true, categoryConfidence: true },
  })
  const total = convs.length
  if (!total) return out

  const convByThread = new Map(convs.map((c) => [c.externalId, c]))
  const gmail = gmailFor(integration)

  // Fetch + reclassify in batches so a large mailbox doesn't hold every raw
  // thread payload in memory at once (fetchThreads bounds network concurrency).
  const BATCH = 100
  const threadIds = convs.map((c) => c.externalId)
  for (let i = 0; i < threadIds.length; i += BATCH) {
    const fetched = await fetchThreads(gmail, threadIds.slice(i, i + BATCH))
    for (const f of fetched) {
      const conv = convByThread.get(f.threadId)
      if (!conv) continue
      out.scanned++
      if (!f.thread) {
        if (f.error) out.errors.push(f.error)
        continue
      }
      let parsed: ParsedThread | null = null
      try {
        parsed = parseThread(integration, f.threadId, f.thread)
      } catch (err) {
        out.errors.push(`Thread ${f.threadId}: ${errMessage(err)}`)
        continue
      }
      if (!parsed) continue

      const firstInbound = parsed.messages.find((m) => m.direction === 'INBOUND') ?? parsed.messages[0]
      const verdict = classifyEmail(
        {
          senderEmail: parsed.contactEmail,
          senderName: parsed.contactName,
          subject: parsed.subject,
          body: firstInbound?.content ?? '',
          gmailLabels: parsed.labels,
          hasListUnsubscribe: parsed.hasListUnsubscribe,
          hasUserReplied: parsed.messages.some((m) => m.direction === 'OUTBOUND'),
        },
        rules,
      )
      const nextSource = verdict.source === 'manual' ? 'manual' : 'rules'
      const unchanged =
        verdict.category === conv.category &&
        nextSource === (conv.categorySource ?? null) &&
        Math.abs((conv.categoryConfidence ?? -1) - verdict.confidence) < 0.001
      if (unchanged) continue

      if (verdict.category !== conv.category) {
        const key = `${conv.category}→${verdict.category}`
        out.moves[key] = (out.moves[key] ?? 0) + 1
        out.changed++
      }
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          category: verdict.category as EmailCategory,
          categorySource: nextSource,
          categoryConfidence: verdict.confidence,
        },
      })
    }
    onProgress?.(out.scanned, total, out.changed)
  }

  return out
}

// ── Push notifications (Gmail watch → Pub/Sub) ──────────────────────────────

export type WatchResult = { historyId?: string; expiration?: string }

/**
 * Register a Gmail push watch on the INBOX so mailbox changes are delivered to
 * our Pub/Sub topic (and on to /api/webhooks/gmail). Watches expire within 7
 * days and must be renewed — see /api/cron/gmail.
 *
 * Deliberately does NOT touch `lastHistoryId`: seeding it here (at connect
 * time, before the first sync) made the first sync take the incremental path
 * and import nothing. The sync itself owns the cursor — no cursor ⇒ full
 * initial import, after which syncGmailForUser stores the watermark.
 */
export async function startGmailWatch(integration: Integration): Promise<WatchResult> {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC
  if (!topicName) throw new Error('GMAIL_PUBSUB_TOPIC is not set')

  const gmail = gmailFor(integration)
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: { topicName, labelIds: ['INBOX'], labelFilterBehavior: 'INCLUDE' },
  })

  const historyId = res.data.historyId ?? undefined
  const expiration = res.data.expiration ?? undefined

  // Atomic merge so a concurrent sync's lastHistoryId write isn't clobbered.
  await mergeIntegrationMetadata(integration.id, { watchExpiration: expiration ?? null })

  return { historyId, expiration }
}

/** Stop an active Gmail push watch (best-effort). Called on disconnect. */
export async function stopGmailWatch(integration: Integration): Promise<void> {
  const gmail = gmailFor(integration)
  await gmail.users.stop({ userId: 'me' }).catch(() => {})
}

// ── Reply sending ───────────────────────────────────────────────────────────

function base64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMime(to: string, subject: string, body: string): string {
  const safeSubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`
  const headers = [
    `To: ${to}`,
    // RFC 2047-encode the subject and base64 the body. A raw UTF-8 Subject
    // header and a 7bit-declared UTF-8 body corrupt non-ASCII replies (the app
    // explicitly supports Cyrillic/emoji) — match the standalone send path.
    `Subject: ${encodeHeader(safeSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ]
  return `${headers.join('\r\n')}\r\n\r\n${base64Body(body)}`
}

export type SendReplyResult = { messageId: string }

/**
 * Send a reply in an existing Gmail conversation and record it as an OUTBOUND
 * message. The conversation MUST already be ownership-checked by the caller.
 */
export async function sendGmailReply(
  organizationId: string,
  conversationId: string,
  body: string,
): Promise<SendReplyResult> {
  // Org-scoped ownership: any member may reply to a shared thread. The reply
  // goes out through the conversation's own integration (the connected inbox),
  // not the acting member's account.
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { contact: true, integration: true },
  })
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.channel !== 'GMAIL') throw new Error('Replies are only supported for Gmail conversations')
  if (!conversation.integration.isActive) throw new Error('Gmail integration is inactive')

  const to = conversation.contact.email
  if (!to) throw new Error('Contact has no email address')

  const gmail = gmailFor(conversation.integration)
  const raw = base64Url(buildMime(to, conversation.subject ?? '(no subject)', body))

  const sent = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: conversation.externalId },
  })

  const messageId = sent.data.id ?? `local-${Date.now()}`
  const now = new Date()

  await prisma.message.upsert({
    where: { conversationId_externalId: { conversationId: conversation.id, externalId: messageId } },
    create: {
      conversationId: conversation.id,
      externalId: messageId,
      direction: 'OUTBOUND',
      content: body,
      contentType: 'TEXT',
      sentAt: now,
    },
    update: {},
  })

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now, awaitingReply: false },
  })

  // A reply went out — any pending auto-draft for this thread is now spent.
  await markDraftSent(conversation.id)

  return { messageId }
}

// ── Standalone message sending (weekly digest & co) ─────────────────────────

/** RFC 2047 header encoding — keeps non-ASCII subjects intact. */
function encodeHeader(value: string): string {
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=` : value
}

/** Wrap base64 at 76 chars per RFC 2045. */
function base64Body(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/(.{76})/g, '$1\r\n')
}

export type SendMessageOptions = {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Send a standalone (non-reply) email through the user's connected Gmail —
 * multipart/alternative so every client gets a readable version. Uses the same
 * OAuth credentials as sync/replies; no SMTP or extra env vars involved.
 */
export async function sendGmailMessage(
  integration: Integration,
  opts: SendMessageOptions,
): Promise<SendReplyResult> {
  const gmail = gmailFor(integration)
  const boundary = `velnox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  const mime = [
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(opts.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(opts.html),
    `--${boundary}--`,
  ].join('\r\n')

  const sent = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: base64Url(mime) },
  })

  return { messageId: sent.data.id ?? `local-${Date.now()}` }
}
