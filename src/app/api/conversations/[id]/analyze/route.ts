import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { analyzeConversation } from '@/services/conversation.analyzer'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'analyze')
  if (limited) return limited

  const { id } = await params

  // Ownership check before running the expensive analysis
  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { organizationId: true },
  })

  if (!conv || conv.organizationId !== ctx.organization.id) return err('Not found', 404)

  try {
    const result = await analyzeConversation(id)
    return ok(result, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed'
    console.error(`[analyze] conversation ${id}:`, e)
    return err(message, 500)
  }
}
