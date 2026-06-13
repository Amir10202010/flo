import { getAuthUser, ok, err } from '@/lib/api'
import { sendWeeklyDigest } from '@/services/digest.service'

// Building the digest + the Gmail send can take a few seconds.
export const maxDuration = 60

/**
 * Manual "send me the digest now" (the button on /insights). Sends a preview
 * copy immediately — it does NOT claim the weekly period, so the scheduled
 * Monday email still goes out. Recipient is always GMAIL_USER_EMAIL.
 */
export async function POST() {
  const { user, error } = await getAuthUser()
  if (!user) return error

  try {
    const result = await sendWeeklyDigest(user.id, { manual: true })

    if (result.status === 'skipped') {
      const message =
        result.reason === 'owner-email-not-set'
          ? 'GMAIL_USER_EMAIL is not configured on the server'
          : result.reason === 'no-integration'
            ? 'Connect Gmail first — the digest is sent through your own mailbox'
            : result.reason === 'not-owner-mailbox'
              ? 'Digest is only available for the workspace owner mailbox (GMAIL_USER_EMAIL)'
              : 'Not enough activity yet — the digest needs at least one week of data'
      return err(message, 400)
    }

    return ok(result)
  } catch (e) {
    console.error('[api/digest/send] failed:', e)
    return err('Failed to send the digest — please try again', 500)
  }
}
