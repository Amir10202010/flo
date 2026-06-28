'use client'

import { useEffect } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { PLAN_CATALOG } from '@/lib/billing'

/**
 * Global "Upgrade to Pro" modal. Opened from anywhere a Pro-gated action is
 * blocked — server routes reply 402 `{ code: 'upgrade_required' }`, the client
 * `handleUpgrade()` helper intercepts it and calls `openUpgrade(message)`. The
 * message is the specific reason ("Upgrade to Pro to use AI drafts"); the body
 * lists what Pro unlocks and links straight into Polar checkout.
 */
const PRO = PLAN_CATALOG.PRO

export default function UpgradeModal() {
  const open = useUiStore((s) => s.upgradeOpen)
  const message = useUiStore((s) => s.upgradeMessage)
  const close = useUiStore((s) => s.closeUpgrade)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className="compose-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="upgrade-modal" role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
        <button type="button" className="compose-x upgrade-x" onClick={close} aria-label="Close">
          <X size={16} />
        </button>

        <span className="upgrade-badge">
          <Sparkles size={13} /> Pro
        </span>

        <h2 className="upgrade-title">{message ?? 'Upgrade to Pro to unlock this'}</h2>
        <p className="upgrade-sub">
          This is a Pro feature. Upgrade to turn Velnox’s AI loose on your inbox — drafts, summaries,
          the assistant and proactive alerts.
        </p>

        <ul className="upgrade-features">
          {PRO.features.map((f) => (
            <li key={f}>
              <Check size={14} /> {f}
            </li>
          ))}
        </ul>

        <div className="upgrade-actions">
          <a className="upgrade-cta" href="/api/billing/checkout?plan=PRO&period=monthly">
            Upgrade to Pro — ${PRO.priceMonthly}/mo
          </a>
          <button type="button" className="compose-cancel" onClick={close}>
            Maybe later
          </button>
        </div>

        <a className="upgrade-compare" href="/pricing" onClick={close}>
          Compare all plans
        </a>
      </div>
    </div>
  )
}
