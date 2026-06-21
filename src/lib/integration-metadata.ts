import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Atomically merge top-level keys into `Integration.metadata`.
 *
 * `metadata` is a single jsonb blob written from several independent places —
 * sync (`lastHistoryId`), watch renewal (`watchExpiration`), the settings toggle
 * (`alertEmailsEnabled`), the alert-email stamp (`lastAlertEmailAt`). The old
 * read-modify-write (`{ ...fresh, key: val }`) lost updates under concurrency:
 * two writers each read, then each wrote back the whole object, and the last
 * write clobbered the other's key.
 *
 * Postgres' jsonb concatenation (`||`) merges/overwrites only the provided keys
 * in ONE statement, so there's no read-modify-write window to lose. `COALESCE`
 * guards a null column. Optionally bumps `syncedAt` in the same write (used by
 * the sync path so the watermark + timestamp move together).
 */
export async function mergeIntegrationMetadata(
  integrationId: string,
  patch: Record<string, unknown>,
  opts: { touchSyncedAt?: boolean } = {},
): Promise<void> {
  const patchJson = JSON.stringify(patch ?? {})
  if (opts.touchSyncedAt) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Integration"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) || ${patchJson}::jsonb,
          "syncedAt" = now()
      WHERE "id" = ${integrationId};
    `)
  } else {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Integration"
      SET "metadata" = COALESCE("metadata", '{}'::jsonb) || ${patchJson}::jsonb
      WHERE "id" = ${integrationId};
    `)
  }
}
