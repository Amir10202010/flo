/**
 * Request-access gate orchestration.
 *
 * While the Gmail OAuth app is in Google Testing mode, only Console "Test users"
 * can connect. A non-approved user submits the mailbox they want to connect;
 * this records the request (deduped by email) and emails the owner
 * (`GMAIL_USER_EMAIL`) so they can add it to the Test users list.
 *
 * Identity mirrors the digest/notification model: the notification is sent FROM
 * the owner's own connected Gmail (the mailbox whose address == GMAIL_USER_EMAIL)
 * TO that same address, via the existing OAuth — no new transport.
 *
 * The owner email is best-effort: the request row is always written first, so a
 * missing/expired owner mailbox never loses the request (the owner can still see
 * it in the DB).
 */
import { prisma } from '@/lib/prisma'
import { shouldNotifyOwner } from '@/lib/access-request'
import { digestOwnerEmail } from './digest.service'
import { integrationEmail, sendGmailMessage } from './gmail.service'

const AUDIENCE_URL = 'https://console.cloud.google.com/auth/audience?project=flo-ai-498805'

export type SubmitAccessRequestInput = { email: string; note: string | null; requestedBy: string | null }
export type SubmitAccessRequestResult = { ok: true; duplicate: boolean }

export async function submitAccessRequest(
  input: SubmitAccessRequestInput,
): Promise<SubmitAccessRequestResult> {
  const { email, note, requestedBy } = input

  // Snapshot the row BEFORE the upsert so the notify-once guard sees prior state.
  const existing = await prisma.accessRequest.findUnique({ where: { email } })
  const record = await prisma.accessRequest.upsert({
    where: { email },
    create: { email, note, requestedBy },
    update: {
      // Refresh the latest note/submitter; never clear an existing note with an
      // omitted one.
      ...(note !== null ? { note } : {}),
      ...(requestedBy ? { requestedBy } : {}),
    },
  })

  if (shouldNotifyOwner(existing)) {
    const payload = {
      email: record.email,
      note: record.note,
      requestedBy: record.requestedBy,
      createdAt: record.createdAt,
    }
    // Telegram first (instant, works even without a connected owner mailbox),
    // then the email. Each channel is best-effort; either one counts as notified.
    const messaged = await notifyTelegramOfAccessRequest(payload).catch((e) => {
      console.warn('[access-request] telegram notification failed (request still recorded):', e)
      return false
    })
    const emailed = await notifyOwnerOfAccessRequest(payload).catch((e) => {
      console.warn('[access-request] owner notification failed (request still recorded):', e)
      return false
    })
    if (messaged || emailed) {
      await prisma.accessRequest
        .update({ where: { id: record.id }, data: { notifiedAt: new Date() } })
        .catch(() => {})
    }
  }

  return { ok: true, duplicate: Boolean(existing) }
}

type OwnerEmailInput = { email: string; note: string | null; requestedBy: string | null; createdAt: Date }

/**
 * Telegram ping to the founder — needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * (create a bot via @BotFather, get your chat id via @userinfobot). Unlike the
 * email path it works even when the owner mailbox isn't connected.
 */
async function notifyTelegramOfAccessRequest(req: OwnerEmailInput): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) return false

  const text = [
    '🔑 Velnox — access request',
    `Email: ${req.email}`,
    ...(req.note ? [`Note: ${req.note}`] : []),
    '',
    `Add to Test users: ${AUDIENCE_URL}`,
  ].join('\n')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`[access-request] telegram sendMessage HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.ok
}

/** Email the owner about a new access request. Returns false when it can't send. */
async function notifyOwnerOfAccessRequest(req: OwnerEmailInput): Promise<boolean> {
  const ownerEmail = digestOwnerEmail()
  if (!ownerEmail) return false

  // Resolve the owner's connected mailbox (address == GMAIL_USER_EMAIL). Scale
  // is tiny, so fetch active Gmail integrations and match by address.
  const integrations = await prisma.integration.findMany({ where: { type: 'GMAIL', isActive: true } })
  const owner = integrations.find((i) => integrationEmail(i) === ownerEmail)
  if (!owner) return false

  const { subject, html, text } = buildAccessRequestEmail(req)
  await sendGmailMessage(owner, { to: ownerEmail, subject, html, text })
  return true
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build the owner notification (subject + html + text). Pure. */
export function buildAccessRequestEmail(req: OwnerEmailInput): { subject: string; html: string; text: string } {
  const subject = `New Velnox access request: ${req.email}`
  const noteLine = req.note || '—'
  const when = req.createdAt.toISOString()

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F6F8FE;font-family:Arial,sans-serif;color:#0C0E1D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #E4E8F4;border-radius:12px;padding:22px 24px;">
      <tr><td style="font-family:Georgia,serif;font-size:19px;padding-bottom:4px;">Velnox · Access request</td></tr>
      <tr><td style="font-size:13px;color:#6B7290;padding-bottom:16px;">Someone wants to connect their Gmail. Add them as a Test user to approve.</td></tr>
      <tr><td style="font-size:14px;padding:4px 0;"><strong>Email:</strong> ${esc(req.email)}</td></tr>
      <tr><td style="font-size:14px;padding:4px 0;"><strong>Note:</strong> ${esc(noteLine)}</td></tr>
      <tr><td style="font-size:12.5px;color:#6B7290;padding:4px 0 16px;">Requested ${esc(when)}${req.requestedBy ? ` · user ${esc(req.requestedBy)}` : ''}</td></tr>
      <tr><td><a href="${AUDIENCE_URL}" style="display:inline-block;background:#4F5CF4;color:#fff;font-size:13.5px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:9px;">Add to Test users →</a></td></tr>
    </table>
  </td></tr></table>
  </body></html>`

  const text = [
    'VELNOX — ACCESS REQUEST',
    '',
    `Email: ${req.email}`,
    `Note: ${noteLine}`,
    `Requested: ${when}${req.requestedBy ? ` (user ${req.requestedBy})` : ''}`,
    '',
    `Add them as a Test user: ${AUDIENCE_URL}`,
  ].join('\n')

  return { subject, html, text }
}
