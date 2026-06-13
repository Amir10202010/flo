import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { listRiskAlerts } from '@/services/alert.service'
import type { AlertStatusValue } from '@/types'

const VALID_STATUS = new Set<AlertStatusValue>(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])

/**
 * List the user's risk alerts.
 *   GET /api/alerts                  → OPEN + ACKNOWLEDGED (the actionable set)
 *   GET /api/alerts?status=RESOLVED  → history
 *   GET /api/alerts?status=all       → everything
 */
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const raw = req.nextUrl.searchParams.get('status')
  let statuses: AlertStatusValue[] = ['OPEN', 'ACKNOWLEDGED']
  if (raw === 'all') {
    statuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED']
  } else if (raw) {
    if (!VALID_STATUS.has(raw as AlertStatusValue)) return err('Invalid status', 400)
    statuses = [raw as AlertStatusValue]
  }

  const items = await listRiskAlerts(user.id, statuses)
  return ok({ items })
}
