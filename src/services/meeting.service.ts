import crypto from 'crypto'
import { Prisma, type MeetingProvider, type MeetingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { timeAgo } from '@/lib/time'
import { embedTexts, getTextProvider } from './ai'
import { extractMeetingKnowledge, generateMeetingBrief } from './ai/knowledge'
import { writeExtractedKnowledge } from './knowledge.extract'
import { companyFromEmail, contactNode, meetingNode, outgoingChips, type NodeChip } from './graph.service'
import { hasCalendarScope, type MeetingAttendee } from './calendar.service'
import { vectorToBuffer } from './embedding.service'
import { enqueueExtractMeetingKnowledge } from './jobs/queue'

/**
 * Meeting intelligence — the read-models behind /meetings, the AI pre-meeting
 * brief, and post-meeting capture (transcript → summary / decisions / action
 * items → knowledge graph).
 *
 * The brief is assembled from REAL workspace data (attendee relationship
 * state, recent threads, facts, previous meetings) and only the closing
 * paragraph is AI-written — no provider, no brief paragraph, but the page
 * still renders every deterministic section.
 */

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface MeetingListItem {
  id: string
  title: string
  provider: MeetingProvider
  status: MeetingStatus
  startsAtIso: string
  endsAtIso: string | null
  joinUrl: string | null
  attendees: { email: string; name: string | null; contactId: string | null }[]
  captured: boolean
  hasDebrief: boolean
}

export interface MeetingsPageData {
  hasIntegration: boolean
  calendarConnected: boolean
  upcoming: MeetingListItem[]
  past: MeetingListItem[]
}

export interface MeetingBriefData {
  provider: string
  brief: string
  talkingPoints: string[]
  generatedAtIso: string
}

export interface MeetingDebriefData {
  provider: string
  summary: string
  decisions: string[]
  actionItems: string[]
  risks: string[]
  followUps: string[]
  topics: string[]
  generatedAtIso: string
}

export interface AttendeeContext {
  email: string
  name: string
  contactId: string | null
  company: string | null
  threadCount: number
  awaitingReply: boolean
  lastThread: { id: string; subject: string; agoLabel: string } | null
  relationshipSummary: string | null
}

export interface MeetingDetail {
  id: string
  title: string
  provider: MeetingProvider
  status: MeetingStatus
  startsAtIso: string
  endsAtIso: string | null
  joinUrl: string | null
  isUpcoming: boolean
  captured: boolean
  /** Captured, but the debrief job hasn't landed yet. */
  pendingDebrief: boolean
  transcript: string | null
  brief: MeetingBriefData | null
  debrief: MeetingDebriefData | null
  attendees: AttendeeContext[]
  recentThreads: { id: string; subject: string; contactName: string; agoLabel: string; href: string }[]
  openReminders: { id: string; note: string }[]
  previousMeetings: { id: string; title: string; startsAtIso: string; summary: string | null }[]
  /** Entities this meeting linked into the knowledge base (post-debrief). */
  linked: NodeChip[]
}

function parseAttendees(raw: Prisma.JsonValue): MeetingAttendee[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a) => {
      const r = a as Record<string, unknown>
      const email = typeof r.email === 'string' ? r.email : null
      if (!email) return null
      return {
        email,
        name: typeof r.name === 'string' ? r.name : null,
        contactId: typeof r.contactId === 'string' ? r.contactId : null,
      }
    })
    .filter((a): a is MeetingAttendee => a !== null)
}

function parseBrief(raw: Prisma.JsonValue | null): MeetingBriefData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const brief = typeof r.brief === 'string' ? r.brief : ''
  if (!brief) return null
  return {
    provider: typeof r.provider === 'string' ? r.provider : 'gemini',
    brief,
    talkingPoints: Array.isArray(r.talkingPoints) ? r.talkingPoints.map(String) : [],
    generatedAtIso: typeof r.generatedAt === 'string' ? r.generatedAt : '',
  }
}

function parseDebrief(raw: Prisma.JsonValue | null): MeetingDebriefData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const summary = typeof r.summary === 'string' ? r.summary : ''
  if (!summary) return null
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
  return {
    provider: typeof r.provider === 'string' ? r.provider : 'gemini',
    summary,
    decisions: list(r.decisions),
    actionItems: list(r.actionItems),
    risks: list(r.risks),
    followUps: list(r.followUps),
    topics: list(r.topics),
    generatedAtIso: typeof r.generatedAt === 'string' ? r.generatedAt : '',
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function getMeetingsPage(userId: string): Promise<MeetingsPageData> {
  const integration = await prisma.integration.findFirst({
    where: { userId, type: 'GMAIL', isActive: true },
    select: { metadata: true },
  })

  const meetings = await prisma.meeting.findMany({
    where: { userId, status: { not: 'CANCELLED' } },
    orderBy: { startsAt: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      provider: true,
      status: true,
      startsAt: true,
      endsAt: true,
      joinUrl: true,
      attendees: true,
      capturedAt: true,
      debrief: true,
    },
  })

  const toItem = (m: (typeof meetings)[number]): MeetingListItem => ({
    id: m.id,
    title: m.title,
    provider: m.provider,
    status: m.status,
    startsAtIso: m.startsAt.toISOString(),
    endsAtIso: m.endsAt?.toISOString() ?? null,
    joinUrl: m.joinUrl,
    attendees: parseAttendees(m.attendees),
    captured: Boolean(m.capturedAt),
    hasDebrief: parseDebrief(m.debrief) !== null,
  })

  const now = Date.now()
  const isPast = (m: (typeof meetings)[number]) =>
    m.status === 'COMPLETED' || (m.endsAt ?? new Date(m.startsAt.getTime() + 3_600_000)).getTime() < now

  return {
    hasIntegration: Boolean(integration),
    calendarConnected: integration ? hasCalendarScope(integration.metadata) : false,
    upcoming: meetings.filter((m) => !isPast(m)).map(toItem),
    past: meetings.filter(isPast).map(toItem).reverse().slice(0, 30),
  }
}

// ── Detail ───────────────────────────────────────────────────────────────────

export async function getMeetingDetail(userId: string, meetingId: string): Promise<MeetingDetail | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
  })
  if (!meeting) return null

  const attendees = parseAttendees(meeting.attendees)
  const contactIds = attendees.map((a) => a.contactId).filter((v): v is string => Boolean(v))

  // Contact rows (names may be richer than the calendar's displayName).
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, userId },
        select: { id: true, name: true },
      })
    : []
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  // Recent threads for the attendee contacts (one query, newest first).
  const threads = contactIds.length
    ? await prisma.conversation.findMany({
        where: { userId, contactId: { in: contactIds } },
        orderBy: { lastMessageAt: 'desc' },
        take: 12,
        select: {
          id: true,
          subject: true,
          contactId: true,
          lastMessageAt: true,
          awaitingReply: true,
          contact: { select: { name: true } },
          analysis: { select: { summary: true } },
        },
      })
    : []
  const threadCounts = contactIds.length
    ? await prisma.conversation.groupBy({
        by: ['contactId'],
        where: { userId, contactId: { in: contactIds } },
        _count: { _all: true },
      })
    : []
  const countByContact = new Map(threadCounts.map((t) => [t.contactId, t._count._all]))

  const now = Date.now()
  const attendeeContexts: AttendeeContext[] = attendees.map((a) => {
    const contact = a.contactId ? contactById.get(a.contactId) : undefined
    const latest = a.contactId ? threads.find((t) => t.contactId === a.contactId) : undefined
    return {
      email: a.email,
      name: contact?.name ?? a.name ?? a.email.split('@')[0],
      contactId: a.contactId,
      company: companyFromEmail(a.email)?.name ?? null,
      threadCount: a.contactId ? (countByContact.get(a.contactId) ?? 0) : 0,
      awaitingReply: Boolean(latest?.awaitingReply),
      lastThread: latest
        ? {
            id: latest.id,
            subject: latest.subject?.trim() || '(no subject)',
            agoLabel: timeAgo(latest.lastMessageAt, now) ?? '',
          }
        : null,
      relationshipSummary: latest?.analysis?.summary ?? null,
    }
  })

  // Open reminders that reference an attendee (by contact name or thread).
  const reminders = await prisma.reminder.findMany({
    where: { userId, status: 'PENDING' },
    orderBy: { dueAt: 'asc' },
    take: 20,
    select: { id: true, note: true, contactName: true, conversationId: true },
  })
  const attendeeNames = new Set(attendeeContexts.map((c) => c.name.toLowerCase()))
  const threadIds = new Set(threads.map((t) => t.id))
  const openReminders = reminders
    .filter(
      (r) =>
        (r.contactName && attendeeNames.has(r.contactName.toLowerCase())) ||
        (r.conversationId && threadIds.has(r.conversationId)),
    )
    .slice(0, 5)
    .map((r) => ({ id: r.id, note: r.note }))

  // Previous meetings with any of the same people (via ATTENDED edges).
  let previousMeetings: MeetingDetail['previousMeetings'] = []
  if (contactIds.length) {
    const attendedEdges = await prisma.graphEdge.findMany({
      where: { userId, kind: 'ATTENDED', fromNode: { in: contactIds.map(contactNode) } },
      select: { toNode: true },
    })
    const meetingIds = [
      ...new Set(attendedEdges.map((e) => e.toNode.slice('meeting:'.length)).filter((id) => id !== meeting.id)),
    ]
    if (meetingIds.length) {
      const rows = await prisma.meeting.findMany({
        where: { id: { in: meetingIds }, userId, startsAt: { lt: meeting.startsAt } },
        orderBy: { startsAt: 'desc' },
        take: 5,
        select: { id: true, title: true, startsAt: true, debrief: true },
      })
      previousMeetings = rows.map((m) => ({
        id: m.id,
        title: m.title,
        startsAtIso: m.startsAt.toISOString(),
        summary: parseDebrief(m.debrief)?.summary ?? null,
      }))
    }
  }

  const chips = await outgoingChips(userId, [meetingNode(meeting.id)])
  const isUpcoming =
    meeting.status === 'UPCOMING' &&
    (meeting.endsAt ?? new Date(meeting.startsAt.getTime() + 3_600_000)).getTime() >= now

  return {
    id: meeting.id,
    title: meeting.title,
    provider: meeting.provider,
    status: meeting.status,
    startsAtIso: meeting.startsAt.toISOString(),
    endsAtIso: meeting.endsAt?.toISOString() ?? null,
    joinUrl: meeting.joinUrl,
    isUpcoming,
    captured: Boolean(meeting.capturedAt),
    pendingDebrief: Boolean(meeting.capturedAt) && parseDebrief(meeting.debrief) === null && Boolean(getTextProvider()),
    transcript: meeting.transcript,
    brief: parseBrief(meeting.brief),
    debrief: parseDebrief(meeting.debrief),
    attendees: attendeeContexts,
    recentThreads: threads.slice(0, 6).map((t) => ({
      id: t.id,
      subject: t.subject?.trim() || '(no subject)',
      contactName: t.contact.name,
      agoLabel: timeAgo(t.lastMessageAt, now) ?? '',
      href: `/inbox/${t.id}`,
    })),
    openReminders,
    previousMeetings,
    linked: chips.get(meetingNode(meeting.id)) ?? [],
  }
}

// ── Pre-meeting brief ────────────────────────────────────────────────────────

/**
 * Generate (or return the cached) AI brief for a meeting. Interactive path —
 * retryable provider errors degrade to null instead of throwing, and the page
 * keeps its deterministic sections either way.
 */
export async function briefMeeting(userId: string, meetingId: string): Promise<MeetingBriefData | null> {
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId } })
  if (!meeting) return null

  const cached = parseBrief(meeting.brief)
  if (cached) return cached
  if (!getTextProvider()) return null

  const detail = await getMeetingDetail(userId, meetingId)
  if (!detail) return null

  const lines: string[] = []
  for (const a of detail.attendees) {
    lines.push(`ATTENDEE: ${a.name} (${a.email})${a.company ? `, ${a.company}` : ''}`)
    if (a.threadCount) lines.push(`  email threads with them: ${a.threadCount}`)
    if (a.lastThread) lines.push(`  last email: "${a.lastThread.subject}" (${a.lastThread.agoLabel})`)
    if (a.awaitingReply) lines.push(`  they are WAITING on your reply`)
    if (a.relationshipSummary) lines.push(`  where things stand: ${a.relationshipSummary}`)
  }
  // Recent facts about the attendees (decisions/actions/risks from any source).
  const aboutRefs = detail.attendees.map((a) => a.contactId).filter((v): v is string => Boolean(v)).map(contactNode)
  if (aboutRefs.length) {
    const facts = await prisma.knowledgeFact.findMany({
      where: { userId, aboutNode: { in: aboutRefs } },
      orderBy: { happenedAt: 'desc' },
      take: 6,
      select: { kind: true, text: true },
    })
    for (const f of facts) lines.push(`FACT (${f.kind.toLowerCase().replace('_', ' ')}): ${f.text}`)
  }
  for (const m of detail.previousMeetings) {
    lines.push(`PREVIOUS MEETING: "${m.title}"${m.summary ? ` — ${m.summary}` : ''}`)
  }
  for (const r of detail.openReminders) lines.push(`OPEN FOLLOW-UP: ${r.note}`)

  const generated = await generateMeetingBrief(
    {
      title: meeting.title,
      startsAt: meeting.startsAt.toISOString(),
      contextLines: lines,
    },
    { fallbackOnRetryable: true },
  )
  if (!generated) return null

  const data: MeetingBriefData = {
    provider: 'gemini',
    brief: generated.brief,
    talkingPoints: generated.talkingPoints,
    generatedAtIso: new Date().toISOString(),
  }
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { brief: { provider: data.provider, brief: data.brief, talkingPoints: data.talkingPoints, generatedAt: data.generatedAtIso } },
  })
  return data
}

// ── Capture + debrief ────────────────────────────────────────────────────────

/** Store the transcript/notes and queue the debrief. Returns the job id for
 *  polling, or null when the meeting doesn't exist / text is too short. */
export async function captureMeeting(userId: string, meetingId: string, transcript: string): Promise<{ jobId: string } | null> {
  const clean = transcript.trim()
  if (clean.length < 40) return null
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId }, select: { id: true } })
  if (!meeting) return null

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      transcript: clean.slice(0, 200_000),
      capturedAt: new Date(),
      status: 'COMPLETED',
      debrief: Prisma.DbNull, // re-capture resets the old debrief
    },
  })
  const job = await enqueueExtractMeetingKnowledge(meeting.id)
  return { jobId: job.id }
}

/** Log a meeting that wasn't on the calendar (provider-agnostic capture). */
export async function logManualMeeting(
  owner: { userId: string; organizationId: string | null },
  input: { title?: string; startsAt?: Date },
): Promise<{ id: string }> {
  return prisma.meeting.create({
    data: {
      userId: owner.userId,
      organizationId: owner.organizationId,
      provider: 'OTHER',
      title: (input.title ?? '').trim().slice(0, 200) || 'Meeting',
      startsAt: input.startsAt ?? new Date(),
      status: 'COMPLETED',
      attendees: [],
    },
    select: { id: true },
  })
}

export interface DebriefResult {
  facts: number
  topics: number
  skipped?: 'missing' | 'no-transcript' | 'no-ai-provider'
}

/** EXTRACT_MEETING_KNOWLEDGE job: transcript → debrief + facts + graph. */
export async function debriefMeeting(
  meetingId: string,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<DebriefResult> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
  if (!meeting) return { facts: 0, topics: 0, skipped: 'missing' }
  if (!meeting.transcript?.trim()) return { facts: 0, topics: 0, skipped: 'no-transcript' }
  if (!getTextProvider()) return { facts: 0, topics: 0, skipped: 'no-ai-provider' }

  const attendees = parseAttendees(meeting.attendees)
  const existingTopics = await prisma.graphEntity.findMany({
    where: { userId: meeting.userId, type: 'TOPIC' },
    orderBy: { weight: 'desc' },
    take: 30,
    select: { name: true, canonicalKey: true },
  })

  const knowledge = await extractMeetingKnowledge(
    {
      title: meeting.title,
      startsAt: meeting.startsAt.toISOString(),
      attendeeNames: attendees.map((a) => a.name ?? a.email),
      transcript: meeting.transcript,
      existingTopics,
    },
    opts,
  )

  const ref = meetingNode(meeting.id)
  const firstContact = attendees.find((a) => a.contactId)?.contactId ?? null
  const written = await writeExtractedKnowledge(
    { userId: meeting.userId, organizationId: meeting.organizationId },
    { type: 'meeting', id: meeting.id, happenedAt: meeting.startsAt },
    { ...knowledge, mentionedContactIds: [] },
    {
      topicFrom: [ref],
      mentionFrom: ref,
      aboutNode: firstContact ? contactNode(firstContact) : null,
    },
  )

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      debrief: {
        provider: 'gemini',
        summary: knowledge.summary,
        decisions: knowledge.decisions,
        actionItems: knowledge.actionItems,
        risks: knowledge.risks,
        followUps: knowledge.followUps,
        topics: knowledge.topics.map((t) => t.name),
        generatedAt: new Date().toISOString(),
      },
    },
  })

  await embedMeeting(meeting.id, meeting.title, knowledge.summary, meeting.transcript)
  return { facts: written.facts, topics: written.topics }
}

/** Embed the meeting for semantic search — best-effort, hash-deduped. */
async function embedMeeting(meetingId: string, title: string, summary: string, transcript: string): Promise<void> {
  try {
    const text = `${title}\n${summary}\n${transcript}`.slice(0, 6000)
    const contentHash = crypto.createHash('sha256').update(text).digest('hex')
    const existing = await prisma.knowledgeEmbedding.findUnique({
      where: { sourceType_sourceId: { sourceType: 'meeting', sourceId: meetingId } },
      select: { contentHash: true },
    })
    if (existing?.contentHash === contentHash) return

    const embedded = await embedTexts([text], 'document')
    if (!embedded) return
    await prisma.knowledgeEmbedding.upsert({
      where: { sourceType_sourceId: { sourceType: 'meeting', sourceId: meetingId } },
      create: {
        sourceType: 'meeting',
        sourceId: meetingId,
        model: embedded.model,
        dims: embedded.dims,
        vector: vectorToBuffer(embedded.vectors[0]),
        contentHash,
      },
      update: {
        model: embedded.model,
        dims: embedded.dims,
        vector: vectorToBuffer(embedded.vectors[0]),
        contentHash,
      },
    })
  } catch (err) {
    console.warn('[meetings] embedding failed (non-fatal):', String(err))
  }
}
