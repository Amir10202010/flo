import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { stopGmailWatch } from '@/services/gmail.service'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integrations = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { type: true, isActive: true, syncedAt: true },
  })

  return NextResponse.json(integrations)
}

export async function DELETE(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type } = await req.json()
  if (!type) {
    return NextResponse.json({ error: 'Missing type' }, { status: 400 })
  }

  // Stop the Gmail push watch before deactivating (best-effort).
  if (type === 'GMAIL') {
    const integration = await prisma.integration.findUnique({
      where: { userId_type: { userId: user.id, type: 'GMAIL' } },
    })
    if (integration) {
      try {
        await stopGmailWatch(integration)
      } catch {
        // ignore — disconnect should still proceed
      }
    }
  }

  await prisma.integration.updateMany({
    where: { userId: user.id, type },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
