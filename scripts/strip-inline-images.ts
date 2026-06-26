/**
 * One-off cleanup: strip embedded base64 `data:` images out of already-stored
 * message bodies to reclaim DB space (newsletters with inline blobs can eat
 * hundreds of KB each). Safe + idempotent — only the base64 payloads are
 * removed; text, remote images and inline-attachment proxy URLs are untouched.
 *
 *   npm run cleanup:inline-images           # apply
 *   npm run cleanup:inline-images -- --dry  # report only, change nothing
 *
 * Inline `cid:` images in old rows are NOT rewritten here (that needs the Gmail
 * attachment map, which only exists during a sync) — they simply re-resolve on
 * the next incremental sync.
 */
import { prisma } from '@/lib/prisma'
import { stripInlineDataImages } from '@/lib/email-inline'

const DRY = process.argv.includes('--dry')
const PAGE = 200

async function main() {
  console.log(`inline-image cleanup ${DRY ? '(dry run)' : '(applying)'}…`)

  let cursor: string | undefined
  let scanned = 0
  let changed = 0
  let bytesSaved = 0

  for (;;) {
    const batch = await prisma.message.findMany({
      where: { contentHtml: { contains: 'data:image' } },
      select: { id: true, contentHtml: true },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id

    for (const m of batch) {
      scanned++
      if (!m.contentHtml) continue
      const { html, removed } = stripInlineDataImages(m.contentHtml)
      if (removed === 0 || html === m.contentHtml) continue
      changed++
      bytesSaved += Buffer.byteLength(m.contentHtml, 'utf-8') - Buffer.byteLength(html, 'utf-8')
      if (!DRY) {
        await prisma.message.update({ where: { id: m.id }, data: { contentHtml: html } })
      }
    }
    process.stdout.write(`  …scanned ${scanned}, cleaned ${changed}\r`)
  }

  const mb = (bytesSaved / (1024 * 1024)).toFixed(2)
  console.log(`\nDone. Scanned ${scanned}, ${DRY ? 'would clean' : 'cleaned'} ${changed} messages, ` +
    `${DRY ? 'would free' : 'freed'} ~${mb} MB.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
