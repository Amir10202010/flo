import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { analyzeConversation } from '@/services/conversation.analyzer'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { id } = await params

  // Ownership check before running the expensive analysis
  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!conv || conv.userId !== user.id) return err('Not found', 404)

  try {
    const result = await analyzeConversation(id)
    return ok(result, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed'
    console.error(`[analyze] conversation ${id}:`, e)
    return err(message, 500)
  }
}
