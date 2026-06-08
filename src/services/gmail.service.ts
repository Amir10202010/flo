import { google, gmail_v1 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { htmlToText } from '@/lib/html'
import type { SyncResult } from '@/types'
import type { Integration } from '@prisma/client'

// How many threads to fetch from Google in parallel. Bounded to stay within
// Gmail per-user rate limits and Supabase's pooled connection budget.
const THREAD_CONCURRENCY = 6
// Cap on threads pulled in a single full sync (first connect / history expiry).
const FULL_SYNC_LIMIT = 50

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
  // Persist refreshed access tokens (re-encrypted) automatically.
  client.on('tokens', (newTokens) => {
    if (newTokens.access_token) {
      prisma.integration
        .update({
          where: { id: integration.id },
          data: { accessToken: encryptSecret(newTokens.access_token) },
        })
        .catch(() => {})
    }
  })
  return client
}

function gmailFor(integration: Integration): GmailClient {
  return google.gmail({ version: 'v1', auth: buildOAuth2Client(integration) })
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

/** Recursively collect the best plain-text body, falling back to converted HTML. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  const found = { text: '', html: '' }

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
    part.parts?.forEach(walk)
  }

  walk(payload)
  if (found.text.trim()) return found.text
  if (found.html.trim()) return htmlToText(found.html)
  return ''
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function integrationEmail(integration: Integration): string {
  const meta = integration.metadata as { email?: string } | null
  return (meta?.email ?? process.env.GMAIL_USER_EMAIL ?? '').toLowerCase()
}

/**
 * Fetch one thread and upsert its contact / conversation / messages.
 * Used by both full sync and incremental (history-driven) sync.
 */
async function processThread(
  gmail: GmailClient,
  userId: string,
  integration: Integration,
  threadId: string,
  result: SyncResult,
): Promise<void> {
  try {
    const threadRes = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
    const messages = (threadRes.data.messages ?? []).slice(-20)
    if (!messages.length) return

    const firstMsg = messages[0]
    const from = headerValue(firstMsg.payload?.headers, 'From')
    const subject = headerValue(firstMsg.payload?.headers, 'Subject') || '(no subject)'

    const emailMatch = from.match(/<(.+?)>/)
    const email = (emailMatch?.[1]?.trim() ?? from.trim()).toLowerCase()
    const name = from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim() || email

    const contact = await prisma.contact.upsert({
      where: { userId_email: { userId, email } },
      create: { userId, name, email, source: 'GMAIL' },
      update: { name },
    })

    const lastMsgDate = new Date(parseInt(messages[messages.length - 1].internalDate ?? '0'))

    const existing = await prisma.conversation.findUnique({
      where: { integrationId_externalId: { integrationId: integration.id, externalId: threadId } },
      select: { id: true },
    })

    const conversation = existing
      ? await prisma.conversation.update({
          where: { id: existing.id },
          data: { lastMessageAt: lastMsgDate },
        })
      : await prisma.conversation.create({
          data: {
            userId,
            contactId: contact.id,
            integrationId: integration.id,
            channel: 'GMAIL',
            externalId: threadId,
            subject,
            lastMessageAt: lastMsgDate,
          },
        })

    const accountEmail = integrationEmail(integration)

    for (const msg of messages) {
      if (!msg.id) continue
      const msgFrom = headerValue(msg.payload?.headers, 'from').toLowerCase()
      const isOutbound = accountEmail ? msgFrom.includes(accountEmail) : false
      const content = extractBody(msg.payload).slice(0, 5000) || '(no text content)'
      const sentAt = new Date(parseInt(msg.internalDate ?? '0'))

      await prisma.message.upsert({
        where: { conversationId_externalId: { conversationId: conversation.id, externalId: msg.id } },
        create: {
          conversationId: conversation.id,
          externalId: msg.id,
          direction: isOutbound ? 'OUTBOUND' : 'INBOUND',
          content,
          contentType: 'TEXT',
          sentAt,
        },
        update: {},
      })
    }

    result.synced++
    if (existing) result.updated++
    else result.created++
  } catch (err) {
    result.errors.push(`Thread ${threadId}: ${String(err)}`)
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
    // 404 => startHistoryId too old/expired; signal caller to do a full resync.
    const status = (err as { code?: number }).code
    if (status === 404) return null
    throw err
  }
}

export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: [] }

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
  // that arrive mid-sync.
  let newHistoryId: string | null = null
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    newHistoryId = profile.data.historyId ?? null
  } catch (err) {
    result.errors.push(`getProfile: ${String(err)}`)
  }

  let threadIds: string[] = []

  if (lastHistoryId) {
    const changed = await changedThreadIds(gmail, lastHistoryId)
    if (changed === null) {
      // History expired — fall back to a bounded full sync.
      const listRes = await gmail.users.threads.list({ userId: 'me', maxResults: FULL_SYNC_LIMIT, labelIds: ['INBOX'] })
      threadIds = (listRes.data.threads ?? []).map((t) => t.id!).filter(Boolean)
    } else {
      threadIds = changed
    }
  } else {
    const listRes = await gmail.users.threads.list({ userId: 'me', maxResults: FULL_SYNC_LIMIT, labelIds: ['INBOX'] })
    threadIds = (listRes.data.threads ?? []).map((t) => t.id!).filter(Boolean)
  }

  await mapPool(threadIds, THREAD_CONCURRENCY, (tid) => processThread(gmail, userId, integration, tid, result))

  await prisma.integration
    .update({
      where: { id: integration.id },
      data: {
        syncedAt: new Date(),
        metadata: { ...meta, ...(newHistoryId ? { lastHistoryId: newHistoryId } : {}) },
      },
    })
    .catch(() => {})

  return result
}

// ── Reply sending ───────────────────────────────────────────────────────────

function base64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMime(to: string, subject: string, body: string): string {
  const safeSubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`
  const headers = [
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ]
  return `${headers.join('\r\n')}\r\n\r\n${body}`
}

export type SendReplyResult = { messageId: string }

/**
 * Send a reply in an existing Gmail conversation and record it as an OUTBOUND
 * message. The conversation MUST already be ownership-checked by the caller.
 */
export async function sendGmailReply(
  userId: string,
  conversationId: string,
  body: string,
): Promise<SendReplyResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
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
    data: { lastMessageAt: now },
  })

  return { messageId }
}
