'use client'

import { useEffect, useState } from 'react'
import { Mail, Trash2, UserPlus } from 'lucide-react'
import type { OrgRole } from '@prisma/client'
import { ROLE_LABEL, assignableRoles, canManageMember } from '@/lib/permissions'

type Member = { membershipId: string; name: string | null; email: string; role: OrgRole; status: string }
type Invite = { id: string; email: string; role: OrgRole; expiresAt: string }

export default function MembersPanel({ myRole }: { myRole: OrgRole }) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('MEMBER')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const grantable = assignableRoles(myRole)

  async function load() {
    const [m, i] = await Promise.all([
      fetch('/api/orgs/members').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/orgs/invitations').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    if (m) { setMembers(m.members ?? []); setMeId(m.me ?? null) }
    if (i) setInvites(i.invitations ?? [])
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    const clean = email.trim()
    if (!clean) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/orgs/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, role }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setMsg({ text: d?.error ?? 'Could not invite', ok: false }); return }
      setEmail(''); setMsg({ text: `Invitation sent to ${clean}`, ok: true })
      load()
    } finally { setBusy(false) }
  }

  async function setMemberRole(m: Member, next: OrgRole) {
    setMembers((prev) => prev.map((x) => (x.membershipId === m.membershipId ? { ...x, role: next } : x)))
    await fetch(`/api/orgs/members/${m.membershipId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }),
    })
    load()
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name ?? m.email} from the organization?`)) return
    await fetch(`/api/orgs/members/${m.membershipId}`, { method: 'DELETE' })
    load()
  }

  async function revoke(i: Invite) {
    await fetch(`/api/orgs/invitations/${i.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Invite form */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <UserPlus size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Invite a teammate</span>
        </div>
        <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com"
            style={{ flex: '1 1 220px', padding: '9px 11px', fontSize: 13.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <select
            value={role} onChange={(e) => setRole(e.target.value as OrgRole)}
            style={{ padding: '9px 11px', fontSize: 13.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
          >
            {grantable.filter((r) => r !== 'OWNER').map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={busy} style={{ padding: '9px 16px', fontSize: 13.5, gap: 6 }}>
            <Mail size={14} /> {busy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {msg && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: msg.ok ? 'var(--success)' : 'var(--hot)' }}>{msg.text}</p>}
      </div>

      {/* Members */}
      <div className="card" style={{ padding: '6px 8px' }}>
        {members.map((m) => {
          const isMe = m.membershipId === meId
          const editable = !isMe && canManageMember(myRole, m.role)
          return (
            <div key={m.membershipId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {(m.name ?? m.email)[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name ?? m.email}{isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · you</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.email}</div>
              </div>
              {editable ? (
                <select value={m.role} onChange={(e) => setMemberRole(m, e.target.value as OrgRole)} style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: '#fff' }}>
                  {assignableRoles(myRole).map((r) => (<option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
                </select>
              ) : (
                <span className="tag" style={{ fontSize: 11 }}>{ROLE_LABEL[m.role]}</span>
              )}
              {editable && (
                <button type="button" onClick={() => remove(m)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 8px 4px' }}>Pending invites</p>
          <div className="card" style={{ padding: '6px 8px' }}>
            {invites.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                <Mail size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{i.email}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ROLE_LABEL[i.role]} · invited</div>
                </div>
                <button type="button" onClick={() => revoke(i)} className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}>Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
