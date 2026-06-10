'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { RiskClientItem } from '@/services/dashboard.service'
import WidgetShell from './WidgetShell'
import ContactAvatar from './ContactAvatar'
import RiskBadge from './RiskBadge'
import EmptyNote from './EmptyNote'

function EngagementBar({ value, delay }: { value: number; delay: number }) {
  const reduced = useReducedMotion()
  const color = value >= 60 ? 'var(--success)' : value >= 35 ? 'var(--attention)' : 'var(--hot)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 96, flexShrink: 0 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 4, background: color }}
          initial={reduced ? { width: `${value}%` } : { width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
        />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

/** Client Risk Monitor — contacts AI flagged, or whose replies are 48h+ overdue. */
export default function RiskMonitor({ items }: { items: RiskClientItem[] }) {
  return (
    <WidgetShell
      icon={<ShieldAlert size={14} />}
      title="Client Risk Monitor"
      sub="From AI risk analysis and reply-time signals"
      status="live"
      action={
        <Link
          href="/risk"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}
        >
          Open monitor
          <ArrowUpRight size={13} />
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyNote
          icon={<ShieldCheck size={17} />}
          title="No clients at risk"
          hint="AI watches every thread for churn signals and overdue replies — flags land here."
        />
      ) : (
        <div style={{ padding: '6px 0' }}>
          {items.map((c, i) => (
            <Link key={c.contactId} href={c.href} className="row-link">
              <ContactAvatar name={c.name} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </span>
                  {c.waiting && (
                    <span style={{ fontSize: 10.5, color: 'var(--attention)', fontWeight: 700, flexShrink: 0 }}>
                      · waiting {c.waiting}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.reason}
                </div>
              </div>
              <EngagementBar value={c.engagement} delay={0.15 + i * 0.05} />
              <RiskBadge level={c.risk} />
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}
