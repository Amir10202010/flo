import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { getNodeContext } from '@/services/graph.service'

/**
 * Context for one knowledge node — the panel behind every node click.
 *   GET /api/knowledge/node?ref=contact:<id> | entity:<id> | meeting:<id> | note:<id>
 */
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrg('VIEWER')
  if (!ctx) return error

  const ref = req.nextUrl.searchParams.get('ref')?.trim() ?? ''
  if (!/^(contact|entity|meeting|note):[A-Za-z0-9_-]+$/.test(ref)) {
    return err('Invalid node ref', 400)
  }
  const context = await getNodeContext(ctx.userId, ref)
  if (!context) return err('Node not found', 404)
  return ok(context)
}
