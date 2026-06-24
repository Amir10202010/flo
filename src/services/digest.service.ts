import { prisma } from '@/lib/prisma'
import { loadWorkspace, replyStats, type Workspace } from './metrics.helpers'
import { computeAlerts, type AlertCandidate } from './alert.engine'
import { integrationEmail, sendGmailMessage } from './gmail.service'
import { orgHasFeature } from './billing.service'
import { formatHours, shortDate } from '@/lib/time'
import type { RiskLevel } from '@/types'

/**
 * Weekly digest email (organization-scoped).
 *
 * Each organization gets one digest built from its shared workspace, sent FROM
 * the org's connected inbox (via the existing Gmail OAuth — no SMTP/extra env)
 * TO the organization owner's address.
 *
 * Idempotency: an EmailDigest row per (owner userId, periodKey) is claimed
 * BEFORE sending — a retry after a successful send can never produce a duplicate
 * email; a failed send releases the claim so the job retry can run. The
 * periodKey embeds the org (`<isoWeek>:<orgId>`) so one owner of several orgs
 * still receives a digest per org.
 */

const DAY_MS = 86_400_000

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * The deployment/app-owner mailbox (GMAIL_USER_EMAIL). This is a GLOBAL identity
 * — the person who runs this Velnox instance — used for app-level concerns like
 * access-request notifications and the manual digest preview. It is NOT the
 * per-organization digest identity (orgs send to their own owners).
 */
export function digestOwnerEmail(): string | null {
  const v = process.env.GMAIL_USER_EMAIL?.trim().toLowerCase()
  return v || null
}

/** Resolve the recipient (org owner email + claim userId) and the inbox to send
 * from. Returns null when the org has no active integration. */
async function resolveDigestTarget(
  organizationId: string,
): Promise<{ integration: Awaited<ReturnType<typeof prisma.integration.findFirst>>; recipient: string | null; claimUserId: string } | null> {
  const integration = await prisma.integration.findFirst({
    where: { organizationId, type: 'GMAIL', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!integration) return null

  const owner = await prisma.membership.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    orderBy: { role: 'asc' }, // OWNER sorts first alphabetically
    include: { user: { select: { id: true, email: true } } },
  })
  const recipient = owner?.user.email ?? integrationEmail(integration)
  const claimUserId = owner?.user.id ?? integration.userId
  return { integration, recipient, claimUserId }
}

// ── Digest read model ───────────────────────────────────────────────────────

export interface DigestData {
  periodKey: string
  weekLabel: string
  stats: {
    inbound: number
    outbound: number
    inboundDeltaPct: number | null
    activeThreads: number
    newContacts: number
    avgReply: string
  }
  needsAttention: { name: string; title: string; reason: string; action: string | null; url: string | null }[]
  quiet: { name: string; reason: string }[]
  topActions: { name: string; action: string; url: string }[]
  appUrl: string
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

const SEVERITY_RANK: Record<RiskLevel, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

export async function buildWeeklyDigest(organizationId: string): Promise<DigestData | null> {
  const ws: Workspace = await loadWorkspace(organizationId)
  if (!ws.integration || ws.conversations.length === 0) return null

  const now = ws.now
  const weekAgo = now - 7 * DAY_MS
  const twoWeeksAgo = now - 14 * DAY_MS

  const thisWeek = ws.messages.filter((m) => m.sentAt.getTime() >= weekAgo)
  const prevWeek = ws.messages.filter((m) => {
    const t = m.sentAt.getTime()
    return t >= twoWeeksAgo && t < weekAgo
  })

  const inbound = thisWeek.filter((m) => m.direction === 'INBOUND').length
  const outbound = thisWeek.filter((m) => m.direction === 'OUTBOUND').length
  if (thisWeek.length === 0 && prevWeek.length === 0) return null // nothing to report

  const reply = replyStats(thisWeek)
  const avgReplyHours = reply.pairs.length
    ? reply.pairs.reduce((a, p) => a + p.hours, 0) / reply.pairs.length
    : null

  const newContacts = new Set(
    ws.conversations
      .filter((c) => c.contact.createdAt.getTime() >= weekAgo)
      .map((c) => c.contact.id),
  ).size

  // Same engine as the Risk Monitor — the email matches what the app shows.
  const alerts = computeAlerts(ws).sort(
    (a, b) => SEVERITY_RANK[b.severity as RiskLevel] - SEVERITY_RANK[a.severity as RiskLevel],
  )
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const link = (c: AlertCandidate) => (c.conversationId ? `${appUrl}/inbox/${c.conversationId}` : null)

  const needsAttention = alerts
    .filter((a) => a.type !== 'gone-quiet')
    .slice(0, 5)
    .map((a) => ({
      name: a.title,
      title: a.title,
      reason: a.reason,
      action: a.suggestedAction,
      url: link(a),
    }))

  const quiet = alerts
    .filter((a) => a.type === 'gone-quiet')
    .slice(0, 3)
    .map((a) => ({ name: a.title.replace(' went quiet', ''), reason: a.reason }))

  const topActions = ws.conversations
    .filter((c) => c.status === 'ACTIVE' && c.analysis?.nextAction)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map((c) => ({
      name: c.contact.name,
      action: c.analysis!.nextAction!,
      url: `${appUrl}/inbox/${c.id}`,
    }))

  return {
    periodKey: isoWeekKey(new Date(now)),
    weekLabel: `${shortDate(new Date(weekAgo))} – ${shortDate(new Date(now))}`,
    stats: {
      inbound,
      outbound,
      inboundDeltaPct: pct(inbound, prevWeek.filter((m) => m.direction === 'INBOUND').length),
      activeThreads: new Set(thisWeek.map((m) => m.conversationId)).size,
      newContacts,
      avgReply: formatHours(avgReplyHours),
    },
    needsAttention,
    quiet,
    topActions,
    appUrl,
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const C = {
  accent: '#4F5CF4',
  text: '#0C0E1D',
  muted: '#6B7290',
  bg: '#F6F8FE',
  card: '#FFFFFF',
  border: '#E4E8F4',
  hot: '#DC2B55',
}

function statCell(label: string, value: string, note?: string | null): string {
  return `<td align="center" style="padding:14px 6px;background:${C.card};border:1px solid ${C.border};border-radius:10px;">
    <div style="font-size:22px;font-weight:700;color:${C.text};font-family:Arial,sans-serif;">${esc(value)}</div>
    <div style="font-size:11px;color:${C.muted};font-family:Arial,sans-serif;margin-top:3px;text-transform:uppercase;letter-spacing:0.4px;">${esc(label)}</div>
    ${note ? `<div style="font-size:11px;color:${C.accent};font-family:Arial,sans-serif;margin-top:2px;">${esc(note)}</div>` : ''}
  </td>`
}

function sectionTitle(title: string): string {
  return `<tr><td style="padding:26px 0 10px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:${C.text};">${esc(title)}</td></tr>`
}

export function renderDigestHtml(d: DigestData): string {
  const delta =
    d.stats.inboundDeltaPct === null
      ? null
      : `${d.stats.inboundDeltaPct >= 0 ? '+' : ''}${d.stats.inboundDeltaPct}% vs last week`

  const attentionRows = d.needsAttention
    .map(
      (a) => `<tr><td style="padding:0 0 10px;">
        <div style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.hot};border-radius:10px;padding:14px 16px;font-family:Arial,sans-serif;">
          <div style="font-size:13.5px;font-weight:700;color:${C.text};">${esc(a.title)}</div>
          <div style="font-size:12.5px;color:${C.muted};margin-top:4px;line-height:1.5;">${esc(a.reason)}</div>
          ${a.action ? `<div style="font-size:12.5px;color:${C.text};margin-top:6px;">→ ${esc(a.action)}</div>` : ''}
          ${a.url ? `<a href="${a.url}" style="display:inline-block;margin-top:8px;font-size:12px;color:${C.accent};text-decoration:none;font-weight:600;">Open thread →</a>` : ''}
        </div>
      </td></tr>`,
    )
    .join('')

  const quietRows = d.quiet
    .map(
      (qc) => `<tr><td style="padding:0 0 8px;font-family:Arial,sans-serif;">
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:12px 16px;">
          <span style="font-size:13px;font-weight:600;color:${C.text};">${esc(qc.name)}</span>
          <span style="font-size:12px;color:${C.muted};"> — ${esc(qc.reason)}</span>
        </div>
      </td></tr>`,
    )
    .join('')

  const actionRows = d.topActions
    .map(
      (a, i) => `<tr><td style="padding:0 0 8px;font-family:Arial,sans-serif;">
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:12px 16px;">
          <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${C.accent};color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:8px;">${i + 1}</span>
          <span style="font-size:13px;font-weight:600;color:${C.text};">${esc(a.name)}:</span>
          <span style="font-size:12.5px;color:${C.muted};">${esc(a.action)}</span>
          <a href="${a.url}" style="font-size:12px;color:${C.accent};text-decoration:none;font-weight:600;"> Open →</a>
        </div>
      </td></tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 18px;font-family:Georgia,serif;">
          <span style="font-size:20px;color:${C.text};font-weight:400;">Velnox</span>
          <span style="font-size:12px;color:${C.muted};font-family:Arial,sans-serif;"> · Weekly digest · ${esc(d.weekLabel)}</span>
        </td></tr>

        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${statCell('New emails', String(d.stats.inbound), delta)}
            <td style="width:8px;"></td>
            ${statCell('Replies sent', String(d.stats.outbound))}
            <td style="width:8px;"></td>
            ${statCell('Active threads', String(d.stats.activeThreads))}
            <td style="width:8px;"></td>
            ${statCell('Avg reply', d.stats.avgReply)}
          </tr></table>
        </td></tr>

        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${d.needsAttention.length ? sectionTitle('Needs your attention') + attentionRows : ''}
            ${d.quiet.length ? sectionTitle('Going quiet') + quietRows : ''}
            ${d.topActions.length ? sectionTitle('Suggested actions for this week') + actionRows : ''}
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 0 8px;">
          <a href="${d.appUrl}/dashboard" style="display:inline-block;background:${C.accent};color:#fff;font-family:Arial,sans-serif;font-size:13.5px;font-weight:600;text-decoration:none;padding:11px 26px;border-radius:10px;">Open dashboard</a>
        </td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:Arial,sans-serif;font-size:11px;color:${C.muted};line-height:1.6;">
          You're receiving this because the weekly digest is enabled for your Velnox workspace.<br>
          Sent every Monday from your own connected Gmail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function renderDigestText(d: DigestData): string {
  const lines: string[] = [
    `VELNOX — WEEKLY DIGEST (${d.weekLabel})`,
    '',
    `New emails: ${d.stats.inbound}` +
      (d.stats.inboundDeltaPct !== null ? ` (${d.stats.inboundDeltaPct >= 0 ? '+' : ''}${d.stats.inboundDeltaPct}% vs last week)` : ''),
    `Replies sent: ${d.stats.outbound}`,
    `Active threads: ${d.stats.activeThreads}`,
    `New contacts: ${d.stats.newContacts}`,
    `Avg reply time: ${d.stats.avgReply}`,
  ]
  if (d.needsAttention.length) {
    lines.push('', 'NEEDS YOUR ATTENTION')
    for (const a of d.needsAttention) {
      lines.push(`- ${a.title}: ${a.reason}${a.action ? ` → ${a.action}` : ''}${a.url ? ` (${a.url})` : ''}`)
    }
  }
  if (d.quiet.length) {
    lines.push('', 'GOING QUIET')
    for (const q of d.quiet) lines.push(`- ${q.name}: ${q.reason}`)
  }
  if (d.topActions.length) {
    lines.push('', 'SUGGESTED ACTIONS')
    d.topActions.forEach((a, i) => lines.push(`${i + 1}. ${a.name}: ${a.action} (${a.url})`))
  }
  lines.push('', `Open dashboard: ${d.appUrl}/dashboard`)
  return lines.join('\n')
}

// ── Sending ─────────────────────────────────────────────────────────────────

export type DigestSendResult =
  | { status: 'sent'; periodKey: string; to: string; messageId: string }
  | { status: 'duplicate-skipped'; periodKey: string }
  | { status: 'skipped'; reason: 'no-integration' | 'no-recipient' | 'no-data' | 'plan' }

/**
 * Build + send the weekly digest for an organization. Sent from the org's
 * connected inbox to the owner's address. `manual` (the "Send now" button)
 * bypasses the weekly dedupe and does NOT claim the period — Monday's scheduled
 * send still goes out.
 */
export async function sendWeeklyDigest(
  organizationId: string,
  opts: { periodKey?: string; manual?: boolean } = {},
): Promise<DigestSendResult> {
  if (!opts.manual && !(await orgHasFeature(organizationId, 'digest'))) {
    return { status: 'skipped', reason: 'plan' }
  }

  const target = await resolveDigestTarget(organizationId)
  if (!target || !target.integration) return { status: 'skipped', reason: 'no-integration' }
  const { integration, recipient, claimUserId } = target
  if (!recipient) return { status: 'skipped', reason: 'no-recipient' }

  const data = await buildWeeklyDigest(organizationId)
  if (!data) return { status: 'skipped', reason: 'no-data' }

  const periodKey = opts.periodKey ?? data.periodKey

  if (!opts.manual) {
    // Claim the period before sending — the unique constraint is the lock.
    try {
      await prisma.emailDigest.create({ data: { userId: claimUserId, organizationId, periodKey } })
    } catch {
      return { status: 'duplicate-skipped', periodKey }
    }
  }

  const attention = data.needsAttention.length
  const subject =
    `${opts.manual ? '[Preview] ' : ''}Your team’s week in review — ${data.stats.inbound} new emails` +
    (attention ? `, ${attention} need${attention === 1 ? 's' : ''} attention` : '')

  try {
    const { messageId } = await sendGmailMessage(integration, {
      to: recipient,
      subject,
      html: renderDigestHtml(data),
      text: renderDigestText(data),
    })
    if (!opts.manual) {
      await prisma.emailDigest.update({
        where: { userId_periodKey: { userId: claimUserId, periodKey } },
        data: { messageId },
      })
    }
    return { status: 'sent', periodKey, to: recipient, messageId }
  } catch (err) {
    if (!opts.manual) {
      // Release the claim so the job retry can attempt the send again.
      await prisma.emailDigest
        .delete({ where: { userId_periodKey: { userId: claimUserId, periodKey } } })
        .catch(() => {})
    }
    throw err
  }
}
