import { prisma } from '@/lib/prisma'
import { domainOf, FREE_MAIL_DOMAINS } from '@/lib/categories'
import type { EmailCategory } from '@/types'

/**
 * Manual category moves + the learning loop behind them.
 *
 * When a user moves a thread, we (1) pin that thread's category as `manual`
 * (so automatic re-classification never undoes it), (2) learn an email-level
 * CategoryRule so future mail from the same sender auto-sorts the same way, and
 * (3) bring the sender's other non-manual threads in line immediately, so the
 * decision feels consistent across the inbox.
 */

export class CategoryMoveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'CategoryMoveError'
  }
}

export interface CategoryMoveResult {
  category: EmailCategory
  /** A sender rule was created/updated (false for contacts without an email). */
  learned: boolean
  /** How many sibling threads from the same sender were re-aligned. */
  realigned: number
}

export async function setConversationCategory(
  organizationId: string,
  userId: string,
  conversationId: string,
  category: EmailCategory,
): Promise<CategoryMoveResult> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { id: true, contactId: true, contact: { select: { email: true } } },
  })
  if (!conv) throw new CategoryMoveError('Not found', 404)

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { category, categorySource: 'manual' },
  })

  // Learn a sender rule so future mail from this address auto-classifies.
  const email = conv.contact.email?.trim().toLowerCase() ?? ''
  let learned = false
  if (email.includes('@')) {
    await prisma.categoryRule.upsert({
      where: { userId_matchType_value: { userId, matchType: 'email', value: email } },
      create: { userId, organizationId, matchType: 'email', value: email, category, source: 'manual', hits: 1 },
      update: { category, source: 'manual', hits: { increment: 1 } },
    })
    learned = true

    // Corporate-domain bonus: a non-freemail domain rule is safe and captures
    // the whole company (e.g. every @acme.com address) without per-address moves.
    const domain = domainOf(email)
    if (domain && !FREE_MAIL_DOMAINS.has(domain)) {
      await prisma.categoryRule.upsert({
        where: { userId_matchType_value: { userId, matchType: 'domain', value: domain } },
        create: { userId, organizationId, matchType: 'domain', value: domain, category, source: 'manual', hits: 1 },
        update: { category, source: 'manual', hits: { increment: 1 } },
      })
    }
  }

  // Re-align the sender's other auto-classified threads (leave manual ones alone).
  const realign = await prisma.conversation.updateMany({
    where: {
      organizationId,
      contactId: conv.contactId,
      id: { not: conv.id },
      categorySource: { not: 'manual' },
    },
    data: { category, categorySource: 'manual' },
  })

  return { category, learned, realigned: realign.count }
}
