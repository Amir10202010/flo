'use client'

import Link from 'next/link'
import { HeartPulse, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { RelationshipHealth as RelData, RelationshipItem } from '@/services/dashboard.service'
import WidgetShell from './WidgetShell'
import ContactAvatar from './ContactAvatar'

function Column({
  icon,
  label,
  color,
  items,
  emptyHint,
}: {
  icon: React.ReactNode
  label: string
  color: string
  items: RelationshipItem[]
  emptyHint: string
}) {
  return (
    <div className="rel-col">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 16px 9px' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 'auto' }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: '6px 16px 18px', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{emptyHint}</p>
      ) : (
        <div style={{ paddingBottom: 8 }}>
          {items.map((it) => (
            <Link key={it.contactId} href={it.href} className="row-link" style={{ padding: '8px 16px' }}>
              <ContactAvatar name={it.name} size={28} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.note}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Relationship Health — the 5-second read on where your client base stands. */
export default function RelationshipHealth({ data }: { data: RelData }) {
  return (
    <WidgetShell
      icon={<HeartPulse size={14} />}
      title="Relationship Health"
      sub="Computed from message cadence, recency and AI sentiment"
      status="live"
      bodyStyle={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="rel-grid">
        <Column
          icon={<TrendingUp size={13} />}
          label="Strongest"
          color="var(--success)"
          items={data.strongest}
          emptyHint="Two-way, recent threads will surface your strongest relationships here."
        />
        <Column
          icon={<TrendingDown size={13} />}
          label="Weakening"
          color="var(--attention)"
          items={data.weakening}
          emptyHint="Contacts whose activity drops off or goes quiet show up here."
        />
        <Column
          icon={<Sparkles size={13} />}
          label="New opportunities"
          color="var(--accent)"
          items={data.opportunities}
          emptyHint="Fresh contacts with positive tone or active threads land here."
        />
      </div>
    </WidgetShell>
  )
}
