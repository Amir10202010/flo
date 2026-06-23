/**
 * Saved replies / snippets — org-scoped templates inserted in the composer.
 * `shared` controls whether the whole team sees a template (vs. just its author).
 * All mutations are audited.
 */
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/services/audit.service'

export class TemplateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'TemplateError'
  }
}

export interface TemplateItem {
  id: string
  title: string
  body: string
  shared: boolean
  createdById: string | null
}

function toItem(t: { id: string; title: string; body: string; shared: boolean; createdById: string | null }): TemplateItem {
  return { id: t.id, title: t.title, body: t.body, shared: t.shared, createdById: t.createdById }
}

/** Templates visible to `userId`: every shared one + the user's own private ones. */
export async function listTemplates(organizationId: string, userId: string): Promise<TemplateItem[]> {
  const rows = await prisma.template.findMany({
    where: { organizationId, OR: [{ shared: true }, { createdById: userId }] },
    orderBy: { title: 'asc' },
  })
  return rows.map(toItem)
}

export async function createTemplate(
  organizationId: string,
  actorId: string,
  input: { title: string; body: string; shared?: boolean },
): Promise<TemplateItem> {
  const title = input.title.trim().slice(0, 80)
  const body = input.body.trim().slice(0, 8000)
  if (!title) throw new TemplateError('Title is required', 400)
  if (!body) throw new TemplateError('Body is required', 400)

  const t = await prisma.template.create({
    data: { organizationId, title, body, shared: input.shared ?? true, createdById: actorId },
  })
  await recordAudit({ organizationId, actorId, action: 'template.created', summary: `Created template “${title}”`, targetType: 'template', targetId: t.id })
  return toItem(t)
}

export async function updateTemplate(
  organizationId: string,
  actorId: string,
  templateId: string,
  patch: { title?: string; body?: string; shared?: boolean },
): Promise<TemplateItem> {
  const t = await prisma.template.findFirst({ where: { id: templateId, organizationId } })
  if (!t) throw new TemplateError('Template not found', 404)
  const updated = await prisma.template.update({
    where: { id: t.id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 80) } : {}),
      ...(patch.body !== undefined ? { body: patch.body.trim().slice(0, 8000) } : {}),
      ...(patch.shared !== undefined ? { shared: patch.shared } : {}),
    },
  })
  await recordAudit({ organizationId, actorId, action: 'template.updated', summary: `Updated template “${updated.title}”`, targetType: 'template', targetId: updated.id })
  return toItem(updated)
}

export async function deleteTemplate(organizationId: string, actorId: string, templateId: string): Promise<void> {
  const t = await prisma.template.findFirst({ where: { id: templateId, organizationId } })
  if (!t) throw new TemplateError('Template not found', 404)
  await prisma.template.delete({ where: { id: t.id } })
  await recordAudit({ organizationId, actorId, action: 'template.deleted', summary: `Deleted template “${t.title}”`, targetType: 'template', targetId: t.id })
}
