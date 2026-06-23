import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { listTemplates, createTemplate, TemplateError } from '@/services/template.service'

/** Saved replies. GET visible templates (member+) / POST create (member+). */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error
  const templates = await listTemplates(ctx.organization.id, ctx.userId)
  return ok({ templates })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const title = typeof (body as { title?: unknown })?.title === 'string' ? (body as { title: string }).title : ''
  const text = typeof (body as { body?: unknown })?.body === 'string' ? (body as { body: string }).body : ''
  const shared = (body as { shared?: unknown })?.shared
  try {
    const template = await createTemplate(ctx.organization.id, ctx.userId, { title, body: text, shared: typeof shared === 'boolean' ? shared : true })
    return ok({ template }, 201)
  } catch (e) {
    if (e instanceof TemplateError) return err(e.message, e.status)
    console.error('[templates] create failed:', e)
    return err('Could not save the template', 500)
  }
}
