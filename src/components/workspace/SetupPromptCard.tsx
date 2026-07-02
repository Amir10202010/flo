/**
 * Dashboard prompt shown while an organization has NO workspace profile —
 * the path into industry specialization for orgs that predate the adaptive
 * layer or skipped the onboarding step. Server-safe (plain Link).
 */
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function SetupPromptCard() {
  return (
    <Link
      href="/workspace/setup"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: 'var(--shadow-xs)',
        padding: '14px 16px',
        textDecoration: 'none',
        marginBottom: 14,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={16} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          Shape Velnox around your business
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
          Tell us what you do — get your own objects, pipelines, KPIs and an industry copilot.
        </span>
      </span>
      <ArrowRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </Link>
  )
}
