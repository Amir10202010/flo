import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${error ?? 'no_code'}`)
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

    // Ensure the Flo user row exists (Supabase auth is separate from Prisma)
    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email! },
      update: {},
    })

    await prisma.integration.upsert({
      where: { userId_type: { userId: user.id, type: 'GMAIL' } },
      create: {
        userId: user.id,
        type: 'GMAIL',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? null,
        isActive: true,
        metadata: { email: user.email },
      },
      update: {
        accessToken: tokens.access_token!,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        isActive: true,
      },
    })

    return NextResponse.redirect(`${appUrl}/integrations?connected=gmail`)
  } catch (e) {
    console.error('[gmail/callback] token exchange failed:', e)
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`)
  }
}
