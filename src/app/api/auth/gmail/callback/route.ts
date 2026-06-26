import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { encryptSecret } from '@/lib/crypto'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'
import { createOrganization } from '@/services/organization.service'
import { startGmailWatch } from '@/services/gmail.service'
import { enqueueGmailSync } from '@/services/jobs/queue'
import { kickJobQueue } from '@/services/jobs/kick'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  const state = req.nextUrl.searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?tab=connections&error=${error ?? 'no_code'}`)
  }

  // CSRF: state from Google must match the cookie we set at the start of the flow.
  const expectedState = req.cookies.get('gmail_oauth_state')?.value
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/settings?tab=connections&error=invalid_state`)
  }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)

    // Resolve the connected mailbox address so we can group/label by account
    // and correctly classify outbound messages.
    let connectedEmail = user.email ?? null
    try {
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const info = await oauth2.userinfo.get()
      connectedEmail = info.data.email ?? connectedEmail
    } catch {
      // Non-fatal: fall back to the Supabase account email.
    }
    // Normalise so push-notification lookups (by emailAddress) match exactly.
    connectedEmail = connectedEmail?.toLowerCase() ?? null

    // Ensure the Velnox user row exists (Supabase auth is separate from Prisma)
    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email! },
      update: {},
    })

    // Resolve the active organization (cookie → first membership → auto-create a
    // personal workspace) so a first connect never dead-ends, and the mailbox is
    // wired as a shared inbox of that org.
    const orgCookie = req.cookies.get(ACTIVE_ORG_COOKIE)?.value
    let organizationId =
      (orgCookie
        ? await prisma.membership.findFirst({
            where: { userId: user.id, organizationId: orgCookie, status: 'ACTIVE' },
            select: { organizationId: true },
          })
        : null
      )?.organizationId ??
      (
        await prisma.membership.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          select: { organizationId: true },
        })
      )?.organizationId ??
      null
    if (!organizationId) {
      const base = (user.email ?? 'My').split('@')[0]
      const org = await createOrganization(user.id, `${base}'s Workspace`)
      organizationId = org.id
    }

    // The shared inbox this mailbox powers (one per org + address).
    const inboxAddress = (connectedEmail ?? `gmail-${user.id}`).toLowerCase()
    const inbox = await prisma.inbox.upsert({
      where: { organizationId_address: { organizationId, address: inboxAddress } },
      create: { organizationId, name: connectedEmail ?? 'Gmail', address: inboxAddress, channel: 'GMAIL' },
      update: { isActive: true, name: connectedEmail ?? 'Gmail' },
    })

    // Merge metadata on reconnect: blindly replacing it wiped lastHistoryId /
    // watchExpiration, breaking incremental sync state. If a DIFFERENT mailbox
    // is being connected, the old history cursor is meaningless — start fresh.
    const prev = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: 'GMAIL' } },
      select: { metadata: true },
    })
    const prevMeta = (prev?.metadata as Record<string, unknown> | null) ?? {}
    const sameMailbox = typeof prevMeta.email === 'string' && prevMeta.email === connectedEmail
    const metadata = sameMailbox ? { ...prevMeta, email: connectedEmail } : { email: connectedEmail }

    const integration = await prisma.integration.upsert({
      where: { userId_type: { userId: user.id, type: 'GMAIL' } },
      create: {
        userId: user.id,
        organizationId,
        inboxId: inbox.id,
        connectedById: user.id,
        type: 'GMAIL',
        accessToken: encryptSecret(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        isActive: true,
        email: connectedEmail,
        metadata,
      },
      update: {
        organizationId,
        inboxId: inbox.id,
        connectedById: user.id,
        accessToken: encryptSecret(tokens.access_token!),
        ...(tokens.refresh_token ? { refreshToken: encryptSecret(tokens.refresh_token) } : {}),
        isActive: true,
        email: connectedEmail,
        metadata,
      },
    })

    // Register a push watch so new mail syncs in real time. Best-effort: if
    // Pub/Sub isn't configured yet, connect still succeeds (cron polling covers it).
    if (process.env.GMAIL_PUBSUB_TOPIC) {
      try {
        await startGmailWatch(integration)
      } catch (e) {
        console.warn('[gmail/callback] startGmailWatch failed (continuing):', e)
      }
    }

    // Kick the first sync so the shared inbox populates right away.
    try {
      await enqueueGmailSync(user.id)
      kickJobQueue()
    } catch (e) {
      console.warn('[gmail/callback] initial sync enqueue failed (continuing):', e)
    }

    const res = NextResponse.redirect(`${appUrl}/dashboard?connected=gmail`)
    res.cookies.delete('gmail_oauth_state')
    // Make the org this mailbox belongs to the active one.
    res.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return res
  } catch (e) {
    console.error('[gmail/callback] token exchange failed:', e)
    return NextResponse.redirect(`${appUrl}/settings?tab=connections&error=token_exchange_failed`)
  }
}
