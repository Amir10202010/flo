import { prisma } from '@/lib/prisma'
import { mergeIntegrationMetadata } from '@/lib/integration-metadata'
import { integrationEmail, sendGmailMessage } from './gmail.service'
import { dueReminders, markRemindersFired } from './reminder.service'
import { shortDate } from '@/lib/time'
import type { RiskLevel } from '@/types'

/**
 * Proactive urgent-alert email.
 *
 * Closes the loop so the manager doesn't have to keep the app open: after a
 * risk scan surfaces NEW critical/high alerts, one rollup email is sent. The
 * sender/recipient identity is GMAIL_USER_EMAIL (same model as the weekly
 * digest) and the mail goes FROM that connected mailbox via the existing OAuth.
 *
 * Anti-spam, by design:
 *  - only CRITICAL/HIGH alerts trigger mail (MEDIUM lives in-app on /risk);
 *  - each alert is notified exactly once — `RiskAlert.notifiedAt` is the guard
 *    (a brand-new row, or a reopened one which clears it, qualifies);
 *  - a per-mailbox throttle (≥6h between alert emails) collapses a sync storm
 *    into at most one mail, so a burst of new alerts can't flood the inbox.
 *
 * Delivery is at-least-once: we send first, then mark `notifiedAt` + the
 * throttle stamp. A failed send leaves nothing marked, so the job retry tries
 * again; a rare double-send (mark fails after a successful send) is dampened by
 * the throttle window and is far less bad than dropping an urgent alert.
 */

const NOTIFY_THROTTLE_MS = 6 * 60 * 60 * 1000 // 6h between alert emails per mailbox
const URGENT_SEVERITIES: RiskLevel[] = ['CRITICAL', 'HIGH']
const SEVERITY_RANK: Record<RiskLevel, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

export type NotifySkipReason =
  | 'no-integration'
  | 'no-recipient'
  | 'disabled'
  | 'nothing-new'
  | 'throttled'

export type NotifyAlertsResult =
  | { status: 'sent'; count: number; to: string; messageId: string }
  | { status: 'skipped'; reason: NotifySkipReason }

export interface AlertEmailItem {
  severity: RiskLevel
  title: string
  reason: string
  suggestedAction: string | null
  conversationId: string | null
}

export interface ReminderEmailItem {
  note: string
  dueLabel: string
  conversationId: string | null
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/**
 * True when an alert email was sent inside the throttle window and a new one
 * must wait. `lastAlertEmailAt` is the ISO stamp stored in Integration.metadata.
 */
export function isThrottled(
  lastAlertEmailAt: string | null | undefined,
  now: number,
  windowMs: number = NOTIFY_THROTTLE_MS,
): boolean {
  if (!lastAlertEmailAt) return false
  const last = Date.parse(lastAlertEmailAt)
  if (Number.isNaN(last)) return false
  return now - last < windowMs
}

/** Highest-severity-first ordering for the email body. */
export function sortUrgent(items: AlertEmailItem[]): AlertEmailItem[] {
  return [...items].sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
}

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

export function alertEmailSubject(items: AlertEmailItem[], reminderCount = 0): string {
  if (!items.length && reminderCount > 0) {
    return `⏰ ${reminderCount} reminder${reminderCount === 1 ? '' : 's'} due — Velnox`
  }
  const n = items.length
  const critical = items.filter((a) => a.severity === 'CRITICAL').length
  const lead = critical > 0 ? '🔴' : '🟠'
  return `${lead} ${n} urgent client${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} attention — Velnox`
}

/** Build the full email (subject + html + text) from urgent alerts + due reminders. */
export function buildAlertEmail(
  rawItems: AlertEmailItem[],
  reminders: ReminderEmailItem[],
  appUrl: string,
): { subject: string; html: string; text: string } {
  const items = sortUrgent(rawItems)
  const base = appUrl.replace(/\/$/, '')
  const subject = alertEmailSubject(items, reminders.length)

  const rows = items
    .map((a) => {
      const accent = a.severity === 'CRITICAL' ? C.hot : C.accent
      const links = a.conversationId
        ? `<div style="margin-top:9px;">
             <a href="${base}/inbox/${a.conversationId}" style="display:inline-block;font-size:12px;color:${C.accent};text-decoration:none;font-weight:600;margin-right:14px;">Open thread →</a>
             <a href="${base}/inbox/${a.conversationId}?draft=1" style="display:inline-block;font-size:12px;color:${C.accent};text-decoration:none;font-weight:600;">✨ Draft a reply →</a>
           </div>`
        : ''
      return `<tr><td style="padding:0 0 10px;">
        <div style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${accent};border-radius:10px;padding:14px 16px;font-family:Arial,sans-serif;">
          <div style="font-size:13.5px;font-weight:700;color:${C.text};">${esc(a.title)}</div>
          <div style="font-size:12.5px;color:${C.muted};margin-top:4px;line-height:1.5;">${esc(a.reason)}</div>
          ${a.suggestedAction ? `<div style="font-size:12.5px;color:${C.text};margin-top:6px;">→ ${esc(a.suggestedAction)}</div>` : ''}
          ${links}
        </div>
      </td></tr>`
    })
    .join('')

  const reminderRows = reminders
    .map(
      (r) => `<tr><td style="padding:0 0 10px;">
        <div style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.accent};border-radius:10px;padding:14px 16px;font-family:Arial,sans-serif;">
          <div style="font-size:13.5px;font-weight:700;color:${C.text};">⏰ ${esc(r.note)}</div>
          <div style="font-size:12px;color:${C.muted};margin-top:4px;">${esc(r.dueLabel)}</div>
          ${r.conversationId ? `<div style="margin-top:9px;"><a href="${base}/inbox/${r.conversationId}" style="display:inline-block;font-size:12px;color:${C.accent};text-decoration:none;font-weight:600;">Open thread →</a></div>` : ''}
        </div>
      </td></tr>`,
    )
    .join('')

  const both = items.length > 0 && reminders.length > 0
  const sectionTitle = (t: string) =>
    `<tr><td style="padding:6px 0 8px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${C.text};text-transform:uppercase;letter-spacing:0.4px;">${esc(t)}</td></tr>`

  const intro = both
    ? `${items.length} client${items.length === 1 ? '' : 's'} need your attention and ${reminders.length} reminder${reminders.length === 1 ? '' : 's'} you set ${reminders.length === 1 ? 'is' : 'are'} due.`
    : items.length
      ? `${items.length} client${items.length === 1 ? '' : 's'} need your attention right now. Acting today protects the relationship.`
      : `${reminders.length} reminder${reminders.length === 1 ? '' : 's'} you set ${reminders.length === 1 ? 'has' : 'have'} come due.`

  const cta = items.length
    ? { href: `${base}/risk`, label: 'Open Risk Monitor' }
    : { href: `${base}/dashboard`, label: 'Open dashboard' }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 16px;font-family:Georgia,serif;">
          <span style="font-size:20px;color:${C.text};font-weight:400;">Velnox</span>
          <span style="font-size:12px;color:${C.muted};font-family:Arial,sans-serif;"> · ${items.length ? 'Urgent alerts' : 'Reminders'}</span>
        </td></tr>
        <tr><td style="padding:0 0 14px;font-family:Arial,sans-serif;font-size:13px;color:${C.muted};line-height:1.5;">
          ${intro}
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${items.length ? (both ? sectionTitle('Needs attention') : '') + rows : ''}
            ${reminders.length ? (both ? sectionTitle('Reminders due') : '') + reminderRows : ''}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 8px;">
          <a href="${cta.href}" style="display:inline-block;background:${C.accent};color:#fff;font-family:Arial,sans-serif;font-size:13.5px;font-weight:600;text-decoration:none;padding:11px 26px;border-radius:10px;">${cta.label}</a>
        </td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:Arial,sans-serif;font-size:11px;color:${C.muted};line-height:1.6;">
          You're receiving this because urgent-alert emails are enabled for your Velnox workspace.<br>
          Sent from your own connected Gmail · manage in Settings.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const lines: string[] = [`VELNOX — ${items.length ? 'URGENT ALERTS' : 'REMINDERS'}`, '', intro, '']
  for (const a of items) {
    lines.push(`- [${a.severity}] ${a.title}: ${a.reason}${a.suggestedAction ? ` → ${a.suggestedAction}` : ''}`)
    if (a.conversationId) lines.push(`  Open: ${base}/inbox/${a.conversationId}`)
  }
  if (reminders.length) {
    lines.push('', 'REMINDERS DUE')
    for (const r of reminders) {
      lines.push(`- ${r.note} (${r.dueLabel})${r.conversationId ? ` ${base}/inbox/${r.conversationId}` : ''}`)
    }
  }
  lines.push('', `${cta.label}: ${cta.href}`)

  return { subject, html, text: lines.join('\n') }
}

// ── Orchestration (I/O) ──────────────────────────────────────────────────────

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Send one rollup email covering the organization's NEW urgent alerts plus any
 * due reminders. Idempotent enough for the job queue (see file header). Sent
 * from the org's connected inbox to the organization owner's address.
 *
 * The 6h throttle suppresses alert-spam only; reminders are user-set and fire
 * on time regardless (guarded once-only by `firedAt`). A reminders-only send
 * does NOT stamp the alert throttle, so it can't delay a later alert email.
 */
export async function notifyNewAlerts(organizationId: string): Promise<NotifyAlertsResult> {
  const integration = await prisma.integration.findFirst({
    where: { organizationId, type: 'GMAIL', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!integration) return { status: 'skipped', reason: 'no-integration' }

  const owner = await prisma.membership.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    orderBy: { role: 'asc' }, // OWNER sorts first alphabetically
    include: { user: { select: { email: true } } },
  })
  const recipient = owner?.user.email ?? integrationEmail(integration)
  if (!recipient) return { status: 'skipped', reason: 'no-recipient' }

  const meta = (integration.metadata as Record<string, unknown> | null) ?? {}
  if (meta.alertEmailsEnabled === false) return { status: 'skipped', reason: 'disabled' }

  const now = Date.now()
  const throttled = isThrottled(typeof meta.lastAlertEmailAt === 'string' ? meta.lastAlertEmailAt : null, now)

  const alertRows = throttled
    ? []
    : await prisma.riskAlert.findMany({
        where: {
          organizationId,
          status: 'OPEN',
          severity: { in: URGENT_SEVERITIES },
          notifiedAt: null,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date(now) } }],
        },
      })

  const due = await dueReminders(organizationId, new Date(now))

  if (!alertRows.length && !due.length) {
    return { status: 'skipped', reason: throttled ? 'throttled' : 'nothing-new' }
  }

  const items: AlertEmailItem[] = alertRows.map((a) => ({
    severity: a.severity as RiskLevel,
    title: a.title,
    reason: a.reason,
    suggestedAction: a.suggestedAction,
    conversationId: a.conversationId,
  }))
  const reminderItems: ReminderEmailItem[] = due.map((r) => ({
    note: r.note,
    dueLabel: `Due ${shortDate(r.dueAt)}`,
    conversationId: r.conversationId,
  }))

  const { subject, html, text } = buildAlertEmail(items, reminderItems, appUrl())
  const { messageId } = await sendGmailMessage(integration, { to: recipient, subject, html, text })

  // Mark only after a successful send.
  const sentAt = new Date()
  if (alertRows.length) {
    await prisma.riskAlert.updateMany({ where: { id: { in: alertRows.map((r) => r.id) } }, data: { notifiedAt: sentAt } })
    // Stamp the alert throttle window — but only when alerts were included.
    // Atomic merge so we don't clobber a concurrent sync's metadata write.
    await mergeIntegrationMetadata(integration.id, { lastAlertEmailAt: sentAt.toISOString() })
  }
  if (due.length) await markRemindersFired(due.map((r) => r.id), sentAt)

  return { status: 'sent', count: alertRows.length + due.length, to: recipient, messageId }
}
