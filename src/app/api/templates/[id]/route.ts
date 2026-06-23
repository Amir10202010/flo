import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { updateTemplate, deleteTemplate, TemplateError } from '@/services/template.service'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null) as { title?: string; body?: string; shared?: boolean } | null
  if (!body) return err('Invalid JSON', 400)
  try {
    const template = await updateTemplate(ctx.organization.id, ctx.userId, id, body)
    return ok({ template })
  } catch (e) {
    if (e instanceof TemplateError) return err(e.message, e.status)
    return err('Could not update the template', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const { id } = await params
  try {
    await deleteTemplate(ctx.organization.id, ctx.userId, id)
    return ok({ deleted: true })
  } catch (e) {
    if (e instanceof TemplateError) return err(e.message, e.status)
    return err('Could not delete the template', 500)
  }
}
