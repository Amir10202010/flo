import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueGmailSync } from '@/services/jobs/queue'

export const dynamic = 'force-dynamic'

/**
 * Gmail push notification receiver (Google Pub/Sub push subscription).
 *
 * Pub/Sub POSTs an envelope:
 *   { message: { data: base64(JSON{ emailAddress, historyId }), ... }, subscription }
 *
 * We authenticate via a verification token in the push URL query string
 * (?token=GMAIL_PUBSUB_VERIFICATION_TOKEN), then enqueue an incremental sync for
 * the matching integration. We ALWAYS ack (2xx) once authenticated so Pub/Sub
 * doesn't redeliver — the heavy lifting happens in the background worker.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN
  if (expected) {
    const token = req.nextUrl.searchParams.get('token')
    if (token !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let emailAddress: string | null = null
  try {
    const body = await req.json()
    const dataB64 = body?.message?.data
    if (dataB64) {
      const decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf-8'))
      emailAddress = typeof decoded?.emailAddress === 'string' ? decoded.emailAddress.toLowerCase() : null
    }
  } catch {
    // Malformed envelope — ack so it isn't redelivered forever.
    return NextResponse.json({ ok: true, ignored: 'bad_payload' })
  }

  if (!emailAddress) {
    return NextResponse.json({ ok: true, ignored: 'no_email' })
  }

  const integration = await prisma.integration.findFirst({
    where: {
      type: 'GMAIL',
      isActive: true,
      metadata: { path: ['email'], equals: emailAddress },
    },
    select: { userId: true },
  })

  if (!integration) {
    // Not ours / disconnected — ack and move on.
    return NextResponse.json({ ok: true, ignored: 'no_integration' })
  }

  await enqueueGmailSync(integration.userId)
  return NextResponse.json({ ok: true, queued: true })
}
