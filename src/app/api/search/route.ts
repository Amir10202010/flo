import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { searchConversations, type SearchFilters } from '@/services/search.service'
import type { Channel, ConversationStatus, PriorityLevel, RiskLevel, Sentiment } from '@/types'

const VALID_STATUS = new Set(['ACTIVE', 'ARCHIVED', 'LOST'])
const VALID_PRIORITY = new Set(['HOT', 'ATTENTION', 'COLD', 'SPAM'])
const VALID_CHANNEL = new Set(['TELEGRAM', 'GMAIL'])
const VALID_RISK = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const VALID_SENTIMENT = new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])

/**
 * Hybrid AI search over the user's conversations.
 *
 *   GET /api/search?q=angry+clients+last+week&limit=20
 *   GET /api/search?q=invoice&priority=HOT&awaiting=true
 *
 * `q` may be natural language (any language) — intent is extracted with the
 * configured AI provider when available; explicit filter params always win.
 * Degrades to keyword-only search with `meta.degraded` notes when AI is off.
 */
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'search')
  if (limited) return limited

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').slice(0, 300)

  const status = sp.get('status')
  const priority = sp.get('priority')
  const channel = sp.get('channel')
  const risk = sp.get('risk')
  const sentiment = sp.get('sentiment')
  const awaitingRaw = sp.get('awaiting')

  if (status && !VALID_STATUS.has(status)) return err('Invalid status', 400)
  if (priority && !VALID_PRIORITY.has(priority)) return err('Invalid priority', 400)
  if (channel && !VALID_CHANNEL.has(channel)) return err('Invalid channel', 400)
  if (risk && !VALID_RISK.has(risk)) return err('Invalid risk', 400)
  if (sentiment && !VALID_SENTIMENT.has(sentiment)) return err('Invalid sentiment', 400)
  if (awaitingRaw && awaitingRaw !== 'true' && awaitingRaw !== 'false') return err('Invalid awaiting', 400)

  const limitParam = sp.get('limit')
  const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10) || 20)) : 20

  const filters: SearchFilters = {
    ...(status ? { status: status as ConversationStatus } : {}),
    ...(priority ? { priority: priority as PriorityLevel } : {}),
    ...(channel ? { channel: channel as Channel } : {}),
    ...(risk ? { risk: risk as RiskLevel } : {}),
    ...(sentiment ? { sentiment: sentiment as Sentiment } : {}),
    ...(awaitingRaw ? { awaiting: awaitingRaw === 'true' } : {}),
  }

  try {
    const result = await searchConversations(user.id, q, filters, limit)
    return ok(result)
  } catch (e) {
    console.error('[api/search] failed:', e)
    return err('Search failed — please try again', 500)
  }
}
