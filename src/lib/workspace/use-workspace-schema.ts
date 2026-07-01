'use client'

/**
 * Client-side access to the workspace schema read-model. Self-fetches
 * `/api/workspace/schema` (the dashboard layout stays DB-free — same pattern
 * as OrgSwitcher) with a module-level cache shared by every consumer, exposed
 * through useSyncExternalStore.
 *
 * Refetch triggers:
 *   window 'velnox:workspace-updated' — dispatched after a blueprint apply
 *   window 'velnox:org-switched'      — dispatched by OrgSwitcher
 */
import { useSyncExternalStore } from 'react'
import type { WorkspaceSchemaModel } from '@/services/workspace/workspace.service'

export type { WorkspaceSchemaModel }

export const WORKSPACE_UPDATED_EVENT = 'velnox:workspace-updated'
export const ORG_SWITCHED_EVENT = 'velnox:org-switched'

/** undefined = not loaded yet; null = org has no workspace profile. */
let cached: WorkspaceSchemaModel | null | undefined
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function load() {
  if (inflight) return
  inflight = fetch('/api/workspace/schema')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      cached = (d?.schema as WorkspaceSchemaModel | null) ?? null
    })
    .catch(() => {
      cached = null
    })
    .then(() => {
      inflight = null
      emit()
    })
}

function invalidate() {
  cached = undefined
  emit()
  load()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener(WORKSPACE_UPDATED_EVENT, invalidate)
    window.addEventListener(ORG_SWITCHED_EVENT, invalidate)
  }
  listeners.add(listener)
  if (cached === undefined) load()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, invalidate)
      window.removeEventListener(ORG_SWITCHED_EVENT, invalidate)
    }
  }
}

const getSnapshot = () => cached
const getServerSnapshot = () => undefined

export interface UseWorkspaceSchemaResult {
  /** Null while loading AND for orgs without a profile — render generic defaults. */
  schema: WorkspaceSchemaModel | null
  loaded: boolean
}

export function useWorkspaceSchema(): UseWorkspaceSchemaResult {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { schema: snap ?? null, loaded: snap !== undefined }
}

/** Notify all consumers that the workspace schema changed (after apply). */
export function announceWorkspaceUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WORKSPACE_UPDATED_EVENT))
}
