import { google, type calendar_v3 } from 'googleapis'
import type { Integration, MeetingProvider, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { oauthClientFor } from './gmail.service'
import { contactNode, meetingNode, upsertGraphEdge } from './graph.service'

/**
 * Google Calendar detection for meeting intelligence — deterministic, no AI.
 *
 * Sync pulls the primary calendar (±2–3 week window), keeps events that are
 * actual meetings (at least one other attendee, not declined), matches
 * attendees to Contacts by email, and derives graph edges:
 *
 *   contact ──ATTENDED──▶ meeting        (per matched attendee)
 *   contact ◀──KNOWS───▶ contact         (co-attendance pairs)
 *
 * Providers are detected from the event's conference/join URLs — the meeting
 * itself is provider-agnostic (capture works by pasting a transcript from any
 * tool), so adding Teams later is a detection pattern, not a new pipeline.
 *
 * Edges are written only for NEWLY matched attendees of each event, so the
 * hourly re-sync never inflates weights.
 */

// ── Pure helpers (unit-tested by scripts/knowledge.check.ts) ─────────────────

const PROVIDER_PATTERNS: { provider: MeetingProvider; pattern: RegExp }[] = [
  { provider: 'GOOGLE_MEET', pattern: /meet\.google\.com/i },
  { provider: 'ZOOM', pattern: /(^|[./])zoom\.(us|com)/i },
]

/** Detect the conferencing provider from any of the event's URL-ish strings. */
export function detectMeetingProvider(candidates: (string | null | undefined)[]): MeetingProvider {
  for (const { provider, pattern } of PROVIDER_PATTERNS) {
    if (candidates.some((c) => c && pattern.test(c))) return provider
  }
  return 'OTHER'
}

/** Canonical unordered co-attendance pairs: sorted within and across pairs. */
export function knowsPairs(contactIds: string[]): [string, string][] {
  const unique = [...new Set(contactIds)].sort()
  const pairs: [string, string][] = []
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) pairs.push([unique[i], unique[j]])
  }
  return pairs
}

/** Does this integration's grant include the Calendar read scope? */
export function hasCalendarScope(metadata: unknown): boolean {
  const scopes = (metadata as Record<string, unknown> | null)?.grantedScopes
  return typeof scopes === 'string' && scopes.includes('auth/calendar.readonly')
}

export interface MeetingAttendee {
  email: string
  name: string | null
  contactId: string | null
}

/** First join-worthy URL from the event (video entry point > hangout link > a
 *  meet/zoom URL found in location/description). */
function extractJoinUrl(event: calendar_v3.Schema$Event): string | null {
  const video = event.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri
  if (video) return video
  if (event.hangoutLink) return event.hangoutLink
  for (const text of [event.location, event.description]) {
    const m = text?.match(/https?:\/\/[^\s<>"']*(?:zoom\.(?:us|com)|meet\.google\.com)[^\s<>"']*/i)
    if (m) return m[0]
  }
  return null
}

// ── Sync ─────────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 14
const LOOKAHEAD_DAYS = 21

export interface CalendarSyncResult {
  scanned: number
  created: number
  updated: number
  skipped?: 'no-integration' | 'no-calendar-scope'
}

/**
 * Incremental-enough calendar sync (the window is small, so a windowed list is
 * simpler and safer than sync tokens). Idempotent: meetings dedupe on
 * (userId, calendarEventId); edges are written only for newly matched
 * attendees. Sequential DB writes — small Prisma pool.
 */
export async function syncCalendarForUser(userId: string): Promise<CalendarSyncResult> {
  const integration = await prisma.integration.findFirst({
    where: { userId, type: 'GMAIL', isActive: true },
  })
  if (!integration) return { scanned: 0, created: 0, updated: 0, skipped: 'no-integration' }
  if (!hasCalendarScope(integration.metadata)) {
    return { scanned: 0, created: 0, updated: 0, skipped: 'no-calendar-scope' }
  }

  const calendar = google.calendar({ version: 'v3', auth: oauthClientFor(integration as Integration) })
  const now = Date.now()
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString(),
    timeMax: new Date(now + LOOKAHEAD_DAYS * 86_400_000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })

  const events = data.items ?? []
  const selfEmail = integration.email?.toLowerCase() ?? null
  let created = 0
  let updated = 0

  for (const event of events) {
    if (!event.id) continue

    // Cancelled on the calendar → reflect and move on.
    if (event.status === 'cancelled') {
      await prisma.meeting.updateMany({
        where: { userId, calendarEventId: event.id, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      })
      continue
    }

    const attendees = (event.attendees ?? []).filter((a) => !a.resource)
    const self = attendees.find((a) => a.self || (a.email && a.email.toLowerCase() === selfEmail))
    if (self?.responseStatus === 'declined') continue

    const others = attendees.filter(
      (a) => a.email && !a.self && a.email.toLowerCase() !== selfEmail && !a.email.endsWith('calendar.google.com'),
    )
    // A meeting is about other people — solo blocks/reminders aren't meetings.
    if (!others.length) continue

    const startsAt = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
        ? new Date(`${event.start.date}T00:00:00Z`)
        : null
    if (!startsAt) continue
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : event.end?.date ? new Date(`${event.end.date}T00:00:00Z`) : null

    // Match attendees to Contacts by email (lowercased).
    const emails = others.map((a) => a.email!.toLowerCase())
    const contacts = await prisma.contact.findMany({
      where: { userId, email: { in: emails } },
      select: { id: true, email: true },
    })
    const contactByEmail = new Map(contacts.map((c) => [c.email!.toLowerCase(), c.id]))
    const attendeeList: MeetingAttendee[] = others.map((a) => ({
      email: a.email!.toLowerCase(),
      name: a.displayName ?? null,
      contactId: contactByEmail.get(a.email!.toLowerCase()) ?? null,
    }))

    const provider = detectMeetingProvider([
      ...(event.conferenceData?.entryPoints?.map((p) => p.uri) ?? []),
      event.conferenceData?.conferenceSolution?.name,
      event.hangoutLink,
      event.location,
      event.description,
    ])

    const endedBy = (endsAt ?? new Date(startsAt.getTime() + 60 * 60_000)).getTime()
    const timeStatus = endedBy < now ? 'COMPLETED' : 'UPCOMING'

    const existing = await prisma.meeting.findUnique({
      where: { userId_calendarEventId: { userId, calendarEventId: event.id } },
      select: { id: true, attendees: true, capturedAt: true },
    })

    const meeting = existing
      ? await prisma.meeting.update({
          where: { id: existing.id },
          data: {
            title: event.summary?.trim() || '(untitled)',
            startsAt,
            endsAt,
            joinUrl: extractJoinUrl(event),
            provider,
            attendees: attendeeList as unknown as Prisma.InputJsonValue,
            // A captured meeting stays COMPLETED; otherwise track the clock.
            status: existing.capturedAt ? 'COMPLETED' : timeStatus,
          },
          select: { id: true },
        })
      : await prisma.meeting.create({
          data: {
            userId,
            organizationId: integration.organizationId,
            provider,
            calendarEventId: event.id,
            title: event.summary?.trim() || '(untitled)',
            startsAt,
            endsAt,
            joinUrl: extractJoinUrl(event),
            status: timeStatus,
            attendees: attendeeList as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        })
    if (existing) updated++
    else created++

    // Graph edges — only for attendees matched since the last sync, so the
    // hourly re-scan never re-bumps weights for the same meeting.
    const prevIds = new Set(
      ((existing?.attendees ?? []) as { contactId?: string | null }[])
        .map((a) => a.contactId)
        .filter((v): v is string => Boolean(v)),
    )
    const matchedIds = attendeeList.map((a) => a.contactId).filter((v): v is string => Boolean(v))
    const freshIds = matchedIds.filter((id) => !prevIds.has(id))

    for (const contactId of freshIds) {
      await upsertGraphEdge(userId, integration.organizationId, contactNode(contactId), meetingNode(meeting.id), 'ATTENDED')
    }
    for (const [a, b] of knowsPairs(matchedIds)) {
      if (!freshIds.includes(a) && !freshIds.includes(b)) continue // pair already recorded
      await upsertGraphEdge(userId, integration.organizationId, contactNode(a), contactNode(b), 'KNOWS')
    }
  }

  return { scanned: events.length, created, updated }
}
