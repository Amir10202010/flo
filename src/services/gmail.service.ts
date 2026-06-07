import { google, gmail_v1 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import type { SyncResult } from '@/types'

function buildOAuth2Client(accessToken: string, refreshToken?: string | null) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  })
  return client
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    } catch {
      return ''
    }
  }
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      try {
        return Buffer.from(textPart.body.data, 'base64').toString('utf-8')
      } catch {}
    }
    for (const part of payload.parts) {
      const body = extractBody(part)
      if (body) return body
    }
  }
  return ''
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

  const oauth2Client = buildOAuth2Client(integration.accessToken, integration.refreshToken)

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { accessToken: newTokens.access_token },
      }).catch(() => {})
    }
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const threadListRes = await gmail.users.threads.list({
    userId: 'me',
    maxResults: 50,
    labelIds: ['INBOX'],
  })
  const threads = threadListRes.data.threads ?? []

  for (const thread of threads) {
    if (!thread.id) continue
    try {
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: thread.id,
        format: 'full',
      })

      const messages = (threadRes.data.messages ?? []).slice(-20)
      if (!messages.length) continue

      const firstMsg = messages[0]
      const headers = firstMsg.payload?.headers ?? []
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

      const from = getHeader('From')
      const subject = getHeader('Subject') || '(no subject)'

      const emailMatch = from.match(/<(.+?)>/)
      const email = emailMatch?.[1]?.trim() ?? from.trim()
      const name = from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim() || email

      const contact = await prisma.contact.upsert({
        where: { userId_email: { userId, email } },
        create: { userId, name, email, source: 'GMAIL' },
        update: { name },
      })

      const lastMsgDate = new Date(parseInt(messages[messages.length - 1].internalDate ?? '0'))

      const existingConv = await prisma.conversation.findUnique({
        where: { integrationId_externalId: { integrationId: integration.id, externalId: thread.id } },
      })

      let conversation
      if (existingConv) {
        conversation = await prisma.conversation.update({
          where: { id: existingConv.id },
          data: { lastMessageAt: lastMsgDate },
        })
        result.updated++
      } else {
        conversation = await prisma.conversation.create({
          data: {
            userId,
            contactId: contact.id,
            integrationId: integration.id,
            channel: 'GMAIL',
            externalId: thread.id,
            subject,
            lastMessageAt: lastMsgDate,
          },
        })
        result.created++
      }

      const userEmail = (process.env.GMAIL_USER_EMAIL ?? '').toLowerCase()

      for (const msg of messages) {
        if (!msg.id) continue

        const msgFrom = (msg.payload?.headers
          ?.find(h => h.name?.toLowerCase() === 'from')?.value ?? '').toLowerCase()
        const isOutbound = userEmail ? msgFrom.includes(userEmail) : false
        const content = extractBody(msg.payload).slice(0, 3000) || '(no text content)'
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
    } catch (err) {
      result.errors.push(`Thread ${thread.id}: ${String(err)}`)
    }
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: { syncedAt: new Date() },
  }).catch(() => {})

  return result
}
