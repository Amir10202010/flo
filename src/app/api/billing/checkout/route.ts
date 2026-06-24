import { NextRequest, NextResponse } from 'next/server'
import type { BillingPlan } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { planToProduct } from '@/lib/polar-plans'
import { getPolar } from '@/lib/polar'

export const dynamic = 'force-dynamic'

const PAID: BillingPlan[] = ['PRO', 'TEAM', 'BUSINESS']

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const self = req.nextUrl.pathname + req.nextUrl.search

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(self)}`, appUrl))

  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(self)}`, appUrl))
  if (!can(ctx.role, 'billing:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const plan = (req.nextUrl.searchParams.get('plan') || '').toUpperCase() as BillingPlan
  const period = req.nextUrl.searchParams.get('period') === 'annual' ? 'annual' : 'monthly'
  if (!PAID.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const productId = planToProduct(plan, period)
  if (!productId) return NextResponse.json({ error: 'Plan not available for checkout' }, { status: 400 })

  try {
    const polar = getPolar()
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: ctx.organization.id,
      customerEmail: ctx.email ?? undefined,
      successUrl: `${appUrl}/settings?checkout=success`,
      metadata: { organizationId: ctx.organization.id, plan, period },
    })
    return NextResponse.redirect(checkout.url, { status: 303 })
  } catch (e) {
    console.error('[billing/checkout] failed:', e)
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
  }
}
