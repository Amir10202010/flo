import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { encryptSecret } from '@/lib/crypto'
import { startGmailWatch } from '@/services/gmail.service'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')
  const state = req.nextUrl.searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${error ?? 'no_code'}`)
  }

  // CSRF: state from Google must match the cookie we set at the start of the flow.
  const expectedState = req.cookies.get('gmail_oauth_state')?.value
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/integrations?error=invalid_state`)
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

    // Ensure the Flo user row exists (Supabase auth is separate from Prisma)
    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email! },
      update: {},
    })

    const integration = await prisma.integration.upsert({
      where: { userId_type: { userId: user.id, type: 'GMAIL' } },
      create: {
        userId: user.id,
        type: 'GMAIL',
        accessToken: encryptSecret(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        isActive: true,
        metadata: { email: connectedEmail },
      },
      update: {
        accessToken: encryptSecret(tokens.access_token!),
        ...(tokens.refresh_token ? { refreshToken: encryptSecret(tokens.refresh_token) } : {}),
        isActive: true,
        metadata: { email: connectedEmail },
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

    const res = NextResponse.redirect(`${appUrl}/integrations?connected=gmail`)
    res.cookies.delete('gmail_oauth_state')
    return res
  } catch (e) {
    console.error('[gmail/callback] token exchange failed:', e)
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`)
  }
}
