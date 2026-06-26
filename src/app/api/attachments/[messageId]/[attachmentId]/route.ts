import { err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { fetchGmailAttachment } from '@/services/gmail.service'

/**
 * On-demand inline-image proxy. Email bodies rewrite `cid:` references (inline
 * attachments) to `/api/attachments/<gmailMessageId>/<attachmentId>` at sync
 * time; this streams the bytes straight from Gmail when the browser asks for
 * them, so inline images render WITHOUT ever being stored in our DB.
 *
 * Scoped to the caller's organization (a thread they can see) and capped to
 * image content types — the proxy can't be turned into a generic attachment
 * exfiltration endpoint.
 */

/** Detect a safe image content type from the leading bytes. SVG is excluded
 *  deliberately (it can carry script). Returns null for anything else. */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 4) return null
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  // BMP
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp'
  // WEBP ("RIFF"…"WEBP")
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  // ICO
  if (buf[0] === 0x00 && buf[1] === 0x00 && (buf[2] === 0x01 || buf[2] === 0x02) && buf[3] === 0x00) return 'image/x-icon'
  return null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> },
) {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const { messageId, attachmentId } = await params

  // The message (and so the attachment) must belong to a thread in the caller's
  // org. We look it up by the Gmail message id to recover the right integration.
  const message = await prisma.message.findFirst({
    where: { externalId: messageId, conversation: { organizationId: ctx.organization.id } },
    select: { conversation: { select: { integration: true } } },
  })
  const integration = message?.conversation.integration
  if (!integration) return err('Not found', 404)

  let bytes: Buffer | null
  try {
    bytes = await fetchGmailAttachment(integration, messageId, attachmentId)
  } catch (e) {
    console.error('[api/attachments] gmail fetch failed:', e)
    return err('Could not load attachment', 502)
  }
  if (!bytes) return err('Not found', 404)

  const contentType = sniffImageType(bytes)
  if (!contentType) return err('Unsupported attachment', 415)

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      // Attachments are immutable for a given (messageId, attachmentId); cache
      // so re-opening a thread never re-hits Gmail.
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
