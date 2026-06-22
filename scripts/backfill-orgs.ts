/**
 * Idempotent data migration: organization-first backfill.
 *
 * For every existing User we create a personal Organization (they become the
 * OWNER), wrap each connected Integration into a shared Inbox, and stamp
 * `organizationId` (and `inboxId` for conversations) onto all of that user's
 * tenant-scoped rows. Safe to re-run: it reuses an existing membership's org and
 * every write is an upsert / idempotent updateMany, so a partial run self-heals.
 *
 * Run:
 *   npx tsx --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/backfill-orgs.ts
 *   (or: npm run backfill:orgs)
 */
import {
  BillingPlan,
  ChannelEnum,
  ConversationState,
  ConversationStatus,
  MemberStatus,
  OrgRole,
  type Organization,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slug'

/** Pick a unique org slug, appending a short suffix on collision. */
async function uniqueSlug(seed: string): Promise<string> {
  const base = slugify(seed)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`
    const taken = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

function channelForType(type: 'GMAIL' | 'TELEGRAM'): ChannelEnum {
  return type === 'TELEGRAM' ? ChannelEnum.TELEGRAM : ChannelEnum.GMAIL
}

async function ensureOrgForUser(user: { id: string; email: string; name: string | null }): Promise<{ org: Organization; created: boolean }> {
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return { org: existing.organization, created: false }

  const displayName = user.name?.trim() || user.email.split('@')[0]
  const orgName = `${displayName}'s Workspace`
  const slug = await uniqueSlug(user.name || user.email)

  const org = await prisma.organization.create({ data: { name: orgName, slug } })
  await prisma.membership.create({
    data: { organizationId: org.id, userId: user.id, role: OrgRole.OWNER, status: MemberStatus.ACTIVE },
  })
  await prisma.subscription.create({ data: { organizationId: org.id, plan: BillingPlan.FREE, seats: 1 } })
  return { org, created: true }
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } })
  console.log(`Backfilling ${users.length} user(s) → organization-first …`)

  let orgsCreated = 0
  let inboxesLinked = 0
  let conversationsUpdated = 0

  for (const user of users) {
    const { org, created } = await ensureOrgForUser(user)
    if (created) orgsCreated++

    // 1. Wrap each Integration into a shared Inbox and stamp its conversations.
    const integrations = await prisma.integration.findMany({ where: { userId: user.id } })
    for (const integ of integrations) {
      const address = (integ.email ?? `${integ.type.toLowerCase()}-${integ.id}@${org.slug}.local`).toLowerCase()
      const inbox = await prisma.inbox.upsert({
        where: { organizationId_address: { organizationId: org.id, address } },
        create: {
          organizationId: org.id,
          name: integ.type === 'GMAIL' ? (integ.email ?? 'Gmail') : 'Telegram',
          address,
          channel: channelForType(integ.type),
        },
        update: {},
      })
      await prisma.integration.update({
        where: { id: integ.id },
        data: { organizationId: org.id, inboxId: inbox.id, connectedById: user.id },
      })
      const res = await prisma.conversation.updateMany({
        where: { userId: user.id, integrationId: integ.id },
        data: { organizationId: org.id, inboxId: inbox.id },
      })
      conversationsUpdated += res.count
      inboxesLinked++
    }

    // 2. Conversations belonging to no integration-linked inbox still get the org.
    await prisma.conversation.updateMany({
      where: { userId: user.id, organizationId: null },
      data: { organizationId: org.id },
    })
    // 3. CLOSED state for archived/lost threads (default is OPEN).
    await prisma.conversation.updateMany({
      where: { userId: user.id, organizationId: org.id, status: { in: [ConversationStatus.ARCHIVED, ConversationStatus.LOST] } },
      data: { state: ConversationState.CLOSED },
    })

    // 4. Stamp organizationId on the remaining tenant-scoped rows (sequential —
    //    the runtime pool is tiny; never fan these out with Promise.all).
    await prisma.contact.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.contactNote.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.categoryRule.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.conversationDraft.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.riskAlert.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.reminder.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
    await prisma.emailDigest.updateMany({ where: { userId: user.id }, data: { organizationId: org.id } })
  }

  console.log(
    `Done. orgs created: ${orgsCreated}, inboxes linked: ${inboxesLinked}, conversations updated: ${conversationsUpdated}.`,
  )
}

main()
  .catch((e) => {
    console.error('BACKFILL FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
