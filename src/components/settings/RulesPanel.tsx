'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import type { OrgRole, PriorityLevel } from '@prisma/client'
import { can } from '@/lib/permissions'

type Member = { membershipId: string; name: string | null; email: string }
type RuleCond = { fromEquals?: string; domainEquals?: string; subjectContains?: string }
type RuleAct = { assignMembershipId?: string; setPriority?: PriorityLevel; close?: boolean }
type Rule = { id: string; name: string; isActive: boolean; conditions: RuleCond; actions: RuleAct }

const PRIORITIES: PriorityLevel[] = ['HOT', 'ATTENTION', 'COLD']

function summarize(r: Rule, members: Member[]): string {
  const c: string[] = []
  if (r.conditions.fromEquals) c.push(`from ${r.conditions.fromEquals}`)
  if (r.conditions.domainEquals) c.push(`domain ${r.conditions.domainEquals}`)
  if (r.conditions.subjectContains) c.push(`subject ~ “${r.conditions.subjectContains}”`)
  const a: string[] = []
  if (r.actions.assignMembershipId) {
    const m = members.find((x) => x.membershipId === r.actions.assignMembershipId)
    a.push(`assign ${m ? m.name ?? m.email : 'member'}`)
  }
  if (r.actions.setPriority) a.push(`priority ${r.actions.setPriority.toLowerCase()}`)
  if (r.actions.close) a.push('close')
  return `When ${c.join(' & ') || '…'} → ${a.join(', ') || '…'}`
}

export default function RulesPanel({ role }: { role: OrgRole }) {
  const canManage = can(role, 'rules:manage')
  const [rules, setRules] = useState<Rule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [open, setOpen] = useState(false)
  // form
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [subject, setSubject] = useState('')
  const [assign, setAssign] = useState('')
  const [priority, setPriority] = useState<'' | PriorityLevel>('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [r, m] = await Promise.all([
      fetch('/api/rules').then((x) => (x.ok ? x.json() : null)).catch(() => null),
      fetch('/api/orgs/members').then((x) => (x.ok ? x.json() : null)).catch(() => null),
    ])
    if (r) setRules(r.rules ?? [])
    if (m) setMembers(m.members ?? [])
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const conditions: RuleCond = {}
    if (domain.trim()) conditions.domainEquals = domain.trim().toLowerCase()
    if (subject.trim()) conditions.subjectContains = subject.trim()
    const actions: RuleAct = {}
    if (assign) actions.assignMembershipId = assign
    if (priority) actions.setPriority = priority
    if (!name.trim() || (!conditions.domainEquals && !conditions.subjectContains) || (!actions.assignMembershipId && !actions.setPriority)) return
    setBusy(true)
    try {
      const r = await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), conditions, actions }) })
      if (r.ok) { setName(''); setDomain(''); setSubject(''); setAssign(''); setPriority(''); setOpen(false); load() }
    } finally { setBusy(false) }
  }

  async function toggle(rule: Rule) {
    setRules((p) => p.map((x) => (x.id === rule.id ? { ...x, isActive: !x.isActive } : x)))
    await fetch(`/api/rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !rule.isActive }) })
  }
  async function remove(rule: Rule) {
    if (!confirm(`Delete rule “${rule.name}”?`)) return
    await fetch(`/api/rules/${rule.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: '0 0 2px', fontSize: 12.5, color: 'var(--text-muted)' }}>
        Rules run on incoming mail — auto-assign, set priority and route threads to the right person.
      </p>

      <div className="card" style={{ padding: '6px 8px' }}>
        {rules.length === 0 && <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No rules yet.</div>}
        {rules.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: r.isActive ? 'var(--accent-dim)' : 'var(--bg-subtle)', color: r.isActive ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={14} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summarize(r, members)}</div>
            </div>
            {canManage && (
              <>
                <button type="button" onClick={() => toggle(r)} className="btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }}>{r.isActive ? 'On' : 'Off'}</button>
                <button type="button" onClick={() => remove(r)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>

      {canManage && !open && (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary" style={{ alignSelf: 'flex-start', gap: 7, fontSize: 13.5, padding: '9px 15px' }}>
          <Plus size={15} /> New rule
        </button>
      )}

      {canManage && open && (
        <form onSubmit={create} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name (e.g. Route Acme to Jane)" style={inp} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>When</div>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Sender domain (acme.com)" style={inp} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject contains…" style={inp} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Then</div>
          <select value={assign} onChange={(e) => setAssign(e.target.value)} style={inp}>
            <option value="">— assign to (optional) —</option>
            {members.map((m) => <option key={m.membershipId} value={m.membershipId}>{m.name ?? m.email}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as PriorityLevel | '')} style={inp}>
            <option value="">— set priority (optional) —</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={busy} style={{ fontSize: 13.5, padding: '9px 16px' }}>{busy ? 'Saving…' : 'Create rule'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ fontSize: 13.5, padding: '9px 16px' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  padding: '9px 11px', fontSize: 13.5, borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none',
}
