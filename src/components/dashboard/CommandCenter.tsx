'use client'

import Link from 'next/link'
import { ArrowRight, ChevronRight, CircleCheck, Sparkles, Zap } from 'lucide-react'
import type { CommandItem } from '@/services/dashboard.service'
import PriorityBadge from '@/components/ui/PriorityBadge'
import WidgetShell from './WidgetShell'
import ContactAvatar from './ContactAvatar'
import EmptyNote from './EmptyNote'

function WaitChip({ waiting }: { waiting: string | null }) {
  if (!waiting) return null
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--attention)',
        background: 'var(--attention-dim)',
        border: '1px solid var(--attention-border)',
        borderRadius: 6,
        padding: '2px 7px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      waiting {waiting}
    </span>
  )
}

/**
 * AI Command Center — the "what should I do right now" module. The hero card
 * is the single highest-scored action; the list below is the rest of today's
 * queue, ranked by priority score + risk + waiting time.
 */
export default function CommandCenter({ hero, items }: { hero: CommandItem | null; items: CommandItem[] }) {
  return (
    <WidgetShell
      icon={<Sparkles size={14} />}
      title="AI Command Center"
      sub="Ranked by priority, churn risk and waiting time"
      status="live"
    >
      {!hero ? (
        <EmptyNote
          icon={<CircleCheck size={17} />}
          title="No pending actions"
          hint="When clients are waiting on you or AI detects risk, your next moves appear here."
        />
      ) : (
        <div style={{ padding: '14px 16px 10px' }}>
          {/* Next best action */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(79,92,244,0.06), rgba(124,77,255,0.05))',
              border: '1px solid rgba(79,92,244,0.2)',
              borderRadius: 13,
              padding: '15px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
              <Zap size={12} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase' }}>
                Next best action
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <WaitChip waiting={hero.waiting} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <ContactAvatar name={hero.contactName} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hero.contactName}
                </div>
                {hero.subject && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hero.subject}
                  </div>
                )}
              </div>
              <PriorityBadge level={hero.priority} />
            </div>

            {(hero.nextAction ?? hero.summary) && (
              <p style={{ margin: '11px 0 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {hero.nextAction ? (
                  <>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>AI suggests:</strong> {hero.nextAction}
                  </>
                ) : (
                  hero.summary
                )}
              </p>
            )}

            {hero.reasons.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
                {hero.reasons.map((r) => (
                  <span
                    key={r}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      borderRadius: 100,
                      padding: '3px 10px',
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 13 }}>
              <Link href={hero.href} className="btn-primary" style={{ fontSize: 13, padding: '9px 16px' }}>
                Open thread
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Rest of today's queue */}
          {items.length > 0 && (
            <div style={{ marginTop: 6, marginLeft: -16, marginRight: -16 }}>
              {items.map((it, i) => (
                <Link key={it.id} href={it.href} className="row-link" style={{ padding: '11px 16px' }}>
                  <span style={{ width: 16, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'center' }}>
                    {i + 2}
                  </span>
                  <ContactAvatar name={it.contactName} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.contactName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.nextAction ?? it.reasons[0] ?? it.subject ?? 'Open thread'}
                    </div>
                  </div>
                  <WaitChip waiting={it.waiting} />
                  <PriorityBadge level={it.priority} />
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  )
}
