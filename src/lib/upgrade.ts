import { useUiStore } from '@/stores/ui.store'

/**
 * If a fetch response is a plan-gate rejection (402 + `code: 'upgrade_required'`,
 * emitted by `upgradeRequired()` server-side), open the global Upgrade-to-Pro
 * modal and return true so the caller can stop instead of surfacing a raw error.
 *
 * Usage:
 *   const res = await fetch(...)
 *   const data = await res.json().catch(() => ({}))
 *   if (handleUpgrade(res, data)) return
 *   if (!res.ok) throw new Error(data.error ?? '…')
 */
export function handleUpgrade(res: Response, data: unknown): boolean {
  if (res.status !== 402) return false
  const code = (data as { code?: string } | null)?.code
  if (code !== 'upgrade_required') return false
  const message = (data as { error?: string } | null)?.error ?? null
  useUiStore.getState().openUpgrade(message)
  return true
}
