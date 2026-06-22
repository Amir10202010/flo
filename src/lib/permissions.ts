/**
 * Role-based access control for organizations — PURE (no DB, no I/O), so it is
 * unit-testable (`npm run test:permissions`) and safe to import anywhere.
 *
 * The four roles form a strict hierarchy by rank; `can(role, action)` is the
 * single source of truth for "is this role allowed to do X". Route handlers and
 * server components gate on `can()` / `requireOrg(minRole)`; the UI hides
 * controls the same way so it never offers an action the server will reject.
 */
import type { OrgRole } from '@prisma/client'

export type { OrgRole }

/** Higher rank = more privilege. Used by `atLeast()` and role pickers. */
export const ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export const ROLE_DESCRIPTION: Record<OrgRole, string> = {
  OWNER: 'Full control, billing, and ownership transfer.',
  ADMIN: 'Manage inboxes, members, rules, templates and billing.',
  MEMBER: 'Work the shared inbox — reply, assign, note, tag.',
  VIEWER: 'Read-only access to inbox and analytics.',
}

/** Every distinct permission in the product. Keep granular, group in the matrix. */
export type OrgAction =
  | 'inbox:read' // see conversations, threads, queue
  | 'inbox:write' // reply, assign, set state, internal note, tag
  | 'inbox:manage' // connect / disconnect / rename shared inboxes
  | 'rules:manage'
  | 'templates:manage'
  | 'tags:manage'
  | 'members:manage' // invite, change role, remove
  | 'billing:manage'
  | 'audit:read'
  | 'analytics:read'
  | 'org:settings' // rename org, general settings
  | 'org:delete' // delete org / transfer ownership

/** The minimum role required for each action (all higher roles inherit it). */
const MIN_ROLE: Record<OrgAction, OrgRole> = {
  'inbox:read': 'VIEWER',
  'analytics:read': 'VIEWER',
  'inbox:write': 'MEMBER',
  'inbox:manage': 'ADMIN',
  'rules:manage': 'ADMIN',
  'templates:manage': 'ADMIN',
  'tags:manage': 'ADMIN',
  'members:manage': 'ADMIN',
  'billing:manage': 'ADMIN',
  'audit:read': 'ADMIN',
  'org:settings': 'ADMIN',
  'org:delete': 'OWNER',
}

/** Is `role` at least as privileged as `min`? */
export function atLeast(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

/** Can a member with `role` perform `action`? The one RBAC gate. */
export function can(role: OrgRole, action: OrgAction): boolean {
  return atLeast(role, MIN_ROLE[action])
}

/**
 * Guard for editing another member: an actor may change/remove a target only if
 * the actor outranks the target, OR the actor is an OWNER. An ADMIN can never
 * modify an OWNER; only an OWNER manages other OWNERs.
 */
export function canManageMember(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (!can(actorRole, 'members:manage')) return false
  if (targetRole === 'OWNER') return actorRole === 'OWNER'
  return ROLE_RANK[actorRole] >= ROLE_RANK[targetRole]
}

/** Roles an actor is allowed to assign when inviting/editing (never above self). */
export function assignableRoles(actorRole: OrgRole): OrgRole[] {
  const all: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
  // Only an owner can grant OWNER.
  return all.filter((r) => (r === 'OWNER' ? actorRole === 'OWNER' : atLeast(actorRole, r)))
}
