import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { sendWeeklyDigest } from '@/services/digest.service'

// Building the digest + the Gmail send can take a few seconds.
export const maxDuration = 60

/**
 * Manual "send me the digest now" (the button on /insights). Sends a preview
 * copy immediately — it does NOT claim the weekly period, so the scheduled
 * Monday email still goes out. Recipient is the organization owner's mailbox.
 */
export async function POST() {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'digestSend')
  if (limited) return limited

  try {
    const result = await sendWeeklyDigest(ctx.organization.id, { manual: true })

    if (result.status === 'skipped') {
      const message =
        result.reason === 'no-integration'
          ? 'Connect a shared inbox first — the digest is sent through your team’s mailbox'
          : result.reason === 'no-recipient'
            ? 'No owner email on file to send the digest to'
            : 'Not enough activity yet — the digest needs at least one week of data'
      return err(message, 400)
    }

    return ok(result)
  } catch (e) {
    console.error('[api/digest/send] failed:', e)
    return err('Failed to send the digest — please try again', 500)
  }
}
