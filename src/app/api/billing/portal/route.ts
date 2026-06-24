import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getPolar } from '@/lib/polar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/login', appUrl))

  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.redirect(new URL('/onboarding', appUrl))
  if (!can(ctx.role, 'billing:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const polar = getPolar()
    const session = await polar.customerSessions.create({ externalCustomerId: ctx.organization.id })
    return NextResponse.redirect(session.customerPortalUrl, { status: 303 })
  } catch (e) {
    console.error('[billing/portal] failed:', e)
    return NextResponse.redirect(new URL('/settings?portal=error', appUrl))
  }
}
