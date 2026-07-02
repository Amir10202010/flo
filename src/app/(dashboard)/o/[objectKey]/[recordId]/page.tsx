import { createElement } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getRecord, listConversationsForRecord } from '@/services/workspace/record.service'
import { iconFor } from '@/lib/workspace/icons'
import { formatFieldValue } from '@/lib/workspace/field-types'
import { Reveal } from '@/components/dashboard/Motion'
import RecordDetailActions from '@/components/workspace/RecordDetailActions'

export const metadata: Metadata = { title: 'Record — Velnox' }

/**
 * Record detail — every field value (registry-formatted) plus the reverse
 * side of the inbox bridge: the email threads linked to this record.
 */
export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ objectKey: string; recordId: string }>
}) {
  const ctx = await requireOrgPage()
  const { objectKey, recordId } = await params

  const found = await getRecord(ctx.organization.id, objectKey, recordId)
  if (!found) notFound()
  const { object, record } = found
  const conversations = await listConversationsForRecord(ctx.organization.id, record.id)

  const stage = record.stageKey ? object.pipeline?.find((s) => s.key === record.stageKey) : null

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <Link href={`/o/${object.key}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 14 }}>
          <ArrowLeft size={13} /> All {object.plural.toLowerCase()}
        </Link>

        <div className="dash-header-row" style={{ marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              {createElement(iconFor(object.icon), { size: 19, style: { color: 'var(--text-secondary)', flexShrink: 0 }, 'aria-hidden': true })}
              <h1 className="page-title" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title}</h1>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
              {object.singular}
              {stage ? ` · ${stage.label}` : ''}
              {` · updated ${record.updatedAgo}`}
            </p>
          </div>
          <RecordDetailActions object={object} record={record} />
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <section style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-xs)', padding: '16px 18px', marginBottom: 14 }}>
          <h2 className="section-title" style={{ margin: '0 0 12px', fontSize: 13 }}>Details</h2>
          {object.fields.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>This object has no fields.</p>
          ) : (
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 20px', margin: 0 }}>
              {object.fields.map((f) => {
                const value = formatFieldValue(f, record.data[f.key])
                return (
                  <div key={f.key} style={{ minWidth: 0 }}>
                    <dt style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{f.label}</dt>
                    <dd style={{ margin: 0, fontSize: 13.5, color: value ? 'var(--text-primary)' : 'var(--text-muted)', overflowWrap: 'break-word' }}>
                      {value || '—'}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-xs)', padding: '16px 18px' }}>
          <h2 className="section-title" style={{ margin: '0 0 12px', fontSize: 13 }}>Linked conversations</h2>
          {conversations.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              No threads linked yet — open a conversation and use “Link a record” in its side panel.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversations.map((c) => (
                <Link
                  key={c.linkId}
                  href={`/inbox/${c.conversationId}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 9, textDecoration: 'none', background: 'var(--bg-base)' }}
                >
                  <Mail size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.contactName}
                    </span>
                    {c.subject && (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.subject}
                      </span>
                    )}
                  </span>
                  {c.lastActivityAgo && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>{c.lastActivityAgo}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>
    </div>
  )
}
