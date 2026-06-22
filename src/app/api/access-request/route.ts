import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { validateAccessRequest } from '@/lib/access-request'
import { submitAccessRequest } from '@/services/access-request.service'

/**
 * Invite-gate request: a logged-in user submits the Gmail they want to connect
 * while the OAuth app is in Google Testing mode. Records the request (deduped)
 * and emails the owner so they can add it to the Console Test users.
 */
export async function POST(req: Request) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const limited = await rateLimit(user.id, 'accessRequest')
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body.', 400)
  }

  const parsed = validateAccessRequest((body ?? {}) as { email?: unknown; note?: unknown })
  if (!parsed.ok) return err(parsed.error, 400)

  const result = await submitAccessRequest({
    email: parsed.email,
    note: parsed.note,
    requestedBy: user.id,
  })

  return ok(result)
}
