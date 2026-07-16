import { prisma } from '@/lib/prisma'

/**
 * Knowledge-graph domain primitives + read-models. See
 * docs/superpowers/specs/2026-07-16-knowledge-base-design.md.
 *
 * Entity nodes are `GraphEntity` rows (COMPANY, TOPIC); Person nodes are the
 * existing `Contact` rows; meetings and notes are their own models. All are
 * referenced from edges as polymorphic string refs — "contact:<id>" |
 * "entity:<id>" | "meeting:<id>" | "note:<id>" — no FK, resolved here.
 *
 * Edge kinds split by provenance:
 *   deterministic — WORKS_AT (email domain), ATTENDED / KNOWS (calendar)
 *   AI-inferred   — DISCUSSED (conversations), MENTIONS (notes / meetings)
 *
 * `weight` bumps on repeat evidence (re-extraction is idempotent: it increments
 * weight rather than duplicating rows — enforced by the DB unique constraints +
 * the increment upserts below, mirrored purely by GraphAccumulator).
 * Extraction orchestration lives in `knowledge.extract.ts`.
 */

// ── Pure helpers (unit-tested by scripts/graph.check.ts) ─────────────────────

/** Free/public mailbox providers whose domain is NOT a company. A message from
 *  bob@gmail.com tells us nothing about where Bob works. */
export const PUBLIC_EMAIL_PROVIDERS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'qq.com',
  '163.com',
  '126.com',
])

/** Registrable multi-part public suffixes, so "team.acme.co.uk" → brand "acme". */
const MULTI_PART_TLDS = new Set<string>([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'or.jp',
  'com.br',
  'com.mx',
  'com.ar',
  'co.in',
  'co.za',
  'com.sg',
  'com.hk',
  'com.tr',
  'co.kr',
])

/** Extract the lowercased registrable domain from an email address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[>,;\s]+$/, '')
  if (!domain || !domain.includes('.') || domain.includes(' ')) return null
  return domain
}

/** A company derived from an email address: dedupe key = the full domain,
 *  display name = the title-cased brand label. Returns null for public
 *  providers (skip-list) and un-parseable / missing domains. */
export function companyFromEmail(
  email: string | null | undefined,
): { canonicalKey: string; name: string } | null {
  const domain = emailDomain(email)
  if (!domain) return null
  if (PUBLIC_EMAIL_PROVIDERS.has(domain)) return null

  const labels = domain.split('.').filter(Boolean)
  if (labels.length < 2) return null

  const lastTwo = labels.slice(-2).join('.')
  const brandIdx =
    MULTI_PART_TLDS.has(lastTwo) && labels.length >= 3 ? labels.length - 3 : labels.length - 2
  const brand = labels[brandIdx] || labels[0]
  const name = brand.charAt(0).toUpperCase() + brand.slice(1)
  return { canonicalKey: domain, name }
}

/** Authoritative topic dedupe key: lowercased, punctuation → spaces, collapsed.
 *  "Q3  Renewal!" → "q3 renewal". Unicode-aware so non-latin topics normalize too. */
export function normalizeTopicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Polymorphic node refs. Person = existing Contact; Company/Topic =
 *  GraphEntity; meetings and notes are their own models. */
export const contactNode = (contactId: string) => `contact:${contactId}`
export const entityNode = (entityId: string) => `entity:${entityId}`
export const meetingNode = (meetingId: string) => `meeting:${meetingId}`
export const noteNode = (noteId: string) => `note:${noteId}`

/** All edge kinds; provenance split drives the UI's honesty labels. */
export type GraphEdgeKindName = 'WORKS_AT' | 'DISCUSSED' | 'ATTENDED' | 'MENTIONS' | 'KNOWS'

/** AI-inferred kinds render dashed + labelled as suggestions, not facts. */
export const AI_EDGE_KINDS: ReadonlySet<GraphEdgeKindName> = new Set(['DISCUSSED', 'MENTIONS'])

export function isDeterministicEdge(kind: GraphEdgeKindName): boolean {
  return !AI_EDGE_KINDS.has(kind)
}

// ── Pure in-memory accumulator ───────────────────────────────────────────────
// Mirrors the DB upsert semantics (dedupe by key, bump weight on repeat). The
// real functions below write through Prisma with the same keys + increments;
// this is what the pure idempotency test exercises.

export interface AccEntity {
  key: string
  type: 'COMPANY' | 'TOPIC'
  canonicalKey: string
  name: string
  weight: number
}
export interface AccEdge {
  key: string
  from: string
  to: string
  kind: GraphEdgeKindName
  weight: number
  lastConversationId: string | null
}

export class GraphAccumulator {
  entities = new Map<string, AccEntity>()
  edges = new Map<string, AccEdge>()

  /** Upsert an entity by (type, canonicalKey); bump weight on repeat. Returns key. */
  bumpEntity(type: 'COMPANY' | 'TOPIC', canonicalKey: string, name: string): string {
    const key = `${type}:${canonicalKey}`
    const cur = this.entities.get(key)
    if (cur) cur.weight += 1
    else this.entities.set(key, { key, type, canonicalKey, name, weight: 1 })
    return key
  }

  /** Upsert an edge by (from, to, kind); bump weight on repeat. */
  bumpEdge(
    from: string,
    to: string,
    kind: GraphEdgeKindName,
    lastConversationId: string | null,
  ): void {
    const key = `${from}|${to}|${kind}`
    const cur = this.edges.get(key)
    if (cur) {
      cur.weight += 1
      cur.lastConversationId = lastConversationId
    } else {
      this.edges.set(key, { key, from, to, kind, weight: 1, lastConversationId })
    }
  }
}

// ── Deterministic company extraction (no AI) ─────────────────────────────────

interface ContactLike {
  id: string
  email: string | null
  userId: string
  organizationId: string | null
}

/**
 * Deterministically derive a COMPANY entity from a contact's email domain and a
 * WORKS_AT edge (contact → company), bumping weight on repeat. No AI. Returns the
 * company GraphEntity id, or null when the contact has no company-y domain
 * (missing email / public provider).
 */
export async function upsertCompanyEdge(
  contact: ContactLike,
  lastConversationId: string | null = null,
): Promise<string | null> {
  const company = companyFromEmail(contact.email)
  if (!company) return null

  const entity = await prisma.graphEntity.upsert({
    where: {
      userId_type_canonicalKey: { userId: contact.userId, type: 'COMPANY', canonicalKey: company.canonicalKey },
    },
    create: {
      userId: contact.userId,
      organizationId: contact.organizationId,
      type: 'COMPANY',
      name: company.name,
      canonicalKey: company.canonicalKey,
    },
    update: { weight: { increment: 1 } },
    select: { id: true },
  })

  await upsertGraphEdge(contact.userId, contact.organizationId, contactNode(contact.id), entityNode(entity.id), 'WORKS_AT', lastConversationId)

  return entity.id
}

/** Upsert a graph edge by (userId, from, to, kind); bump weight on repeat.
 *  Shared by every extraction flavor (conversations, meetings, notes). */
export async function upsertGraphEdge(
  userId: string,
  organizationId: string | null,
  fromNode: string,
  toNode: string,
  kind: GraphEdgeKindName,
  lastConversationId: string | null = null,
): Promise<void> {
  await prisma.graphEdge.upsert({
    where: { userId_fromNode_toNode_kind: { userId, fromNode, toNode, kind } },
    create: { userId, organizationId, fromNode, toNode, kind, lastConversationId },
    update: { weight: { increment: 1 }, ...(lastConversationId ? { lastConversationId } : {}) },
  })
}

// ── Read-model for /knowledge ────────────────────────────────────────────────

export type GraphNodeType = 'PERSON' | 'COMPANY' | 'TOPIC' | 'MEETING' | 'NOTE'

export interface GraphNode {
  /** Node ref: "contact:<id>" for people, "entity:<id>" for companies/topics. */
  id: string
  type: GraphNodeType
  label: string
  /** Email (person) or domain (company); null for topics. */
  sublabel: string | null
  weight: number
}

export interface GraphLink {
  id: string
  source: string
  target: string
  kind: GraphEdgeKindName
  /** WORKS_AT / ATTENDED / KNOWS = deterministic; DISCUSSED / MENTIONS = AI. */
  deterministic: boolean
  weight: number
  conversationId: string | null
}

export interface GraphConversationRef {
  id: string
  subject: string
  contactName: string
  href: string
  lastMessageAt: string | null
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  links: GraphLink[]
  conversations: GraphConversationRef[]
  stats: { people: number; companies: number; topics: number; meetings: number; notes: number; edges: number }
  hasData: boolean
}

/**
 * One batched read-model for /knowledge: nodes (people + companies + topics +
 * meetings + notes) and edges, plus the conversations edges cite (the evidence
 * trail). Sequential queries only — the runtime Prisma pool is intentionally
 * small (see CLAUDE.md / metrics.helpers), so no Promise.all fan-out here.
 */
export async function getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
  const entities = await prisma.graphEntity.findMany({
    where: { userId },
    select: { id: true, type: true, name: true, canonicalKey: true, weight: true },
  })

  const edges = await prisma.graphEdge.findMany({
    where: { userId },
    orderBy: { weight: 'desc' },
    select: { id: true, fromNode: true, toNode: true, kind: true, weight: true, lastConversationId: true },
  })

  // Contacts / meetings / notes referenced by any edge endpoint.
  const contactIds = new Set<string>()
  const meetingIds = new Set<string>()
  const noteIds = new Set<string>()
  for (const e of edges) {
    for (const ref of [e.fromNode, e.toNode]) {
      if (ref.startsWith('contact:')) contactIds.add(ref.slice('contact:'.length))
      else if (ref.startsWith('meeting:')) meetingIds.add(ref.slice('meeting:'.length))
      else if (ref.startsWith('note:')) noteIds.add(ref.slice('note:'.length))
    }
  }
  const contacts = contactIds.size
    ? await prisma.contact.findMany({
        where: { id: { in: [...contactIds] }, userId },
        select: { id: true, name: true, email: true },
      })
    : []
  const meetings = meetingIds.size
    ? await prisma.meeting.findMany({
        where: { id: { in: [...meetingIds] }, userId },
        select: { id: true, title: true, startsAt: true },
      })
    : []
  const notes = noteIds.size
    ? await prisma.note.findMany({
        where: { id: { in: [...noteIds] }, userId },
        select: { id: true, title: true, body: true, updatedAt: true },
      })
    : []

  // Conversations cited by edges (the evidence trail for the sidebar).
  const convIds = [...new Set(edges.map((e) => e.lastConversationId).filter((v): v is string => Boolean(v)))]
  const conversations = convIds.length
    ? await prisma.conversation.findMany({
        where: { id: { in: convIds }, userId },
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true,
          subject: true,
          lastMessageAt: true,
          contact: { select: { name: true } },
        },
      })
    : []

  // Build the node set. An entity node always exists; a person node exists only
  // when a resolvable Contact backs the ref.
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  const nodes: GraphNode[] = []
  const nodeIds = new Set<string>()
  const personWeight = new Map<string, number>()

  for (const e of entities) {
    const id = entityNode(e.id)
    nodes.push({
      id,
      type: e.type as 'COMPANY' | 'TOPIC',
      label: e.name,
      sublabel: e.type === 'COMPANY' ? e.canonicalKey : null,
      weight: e.weight,
    })
    nodeIds.add(id)
  }

  // Person nodes + accumulate their incident-edge weight for sizing.
  for (const cid of contactIds) {
    const c = contactById.get(cid)
    if (!c) continue // Contact deleted — its edges will be dropped below.
    const id = contactNode(cid)
    nodes.push({ id, type: 'PERSON', label: c.name, sublabel: c.email, weight: 1 })
    nodeIds.add(id)
    personWeight.set(id, 0)
  }

  // Meeting + note nodes (dropped silently when the backing row is gone).
  for (const m of meetings) {
    const id = meetingNode(m.id)
    nodes.push({
      id,
      type: 'MEETING',
      label: m.title.trim() || 'Meeting',
      sublabel: m.startsAt.toISOString().slice(0, 10),
      weight: 2,
    })
    nodeIds.add(id)
  }
  for (const n of notes) {
    const id = noteNode(n.id)
    const fallback = n.body.replace(/\s+/g, ' ').trim().slice(0, 40)
    nodes.push({
      id,
      type: 'NOTE',
      label: n.title.trim() || fallback || 'Note',
      sublabel: n.updatedAt.toISOString().slice(0, 10),
      weight: 1,
    })
    nodeIds.add(id)
  }

  // Keep only edges whose BOTH endpoints resolved to a real node.
  const links: GraphLink[] = []
  for (const e of edges) {
    if (!nodeIds.has(e.fromNode) || !nodeIds.has(e.toNode)) continue
    const kind = e.kind as GraphEdgeKindName
    links.push({
      id: e.id,
      source: e.fromNode,
      target: e.toNode,
      kind,
      weight: e.weight,
      deterministic: isDeterministicEdge(kind),
      conversationId: e.lastConversationId,
    })
    if (personWeight.has(e.fromNode)) personWeight.set(e.fromNode, (personWeight.get(e.fromNode) ?? 0) + e.weight)
    if (personWeight.has(e.toNode)) personWeight.set(e.toNode, (personWeight.get(e.toNode) ?? 0) + e.weight)
  }
  // Apply accumulated weight to person nodes (min 1 so isolated people stay visible).
  for (const n of nodes) {
    if (n.type === 'PERSON') n.weight = Math.max(1, personWeight.get(n.id) ?? 0)
  }

  const conversationRefs: GraphConversationRef[] = conversations.map((c) => ({
    id: c.id,
    subject: c.subject?.trim() || '(no subject)',
    contactName: c.contact.name,
    href: `/inbox/${c.id}`,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
  }))

  const stats = {
    people: nodes.filter((n) => n.type === 'PERSON').length,
    companies: nodes.filter((n) => n.type === 'COMPANY').length,
    topics: nodes.filter((n) => n.type === 'TOPIC').length,
    meetings: nodes.filter((n) => n.type === 'MEETING').length,
    notes: nodes.filter((n) => n.type === 'NOTE').length,
    edges: links.length,
  }

  // A lone entity with no surviving edge is noise — the graph "has data" only
  // when there's at least one link to render.
  return { nodes, links, conversations: conversationRefs, stats, hasData: links.length > 0 }
}

// ── Outgoing-link chips (shared by notes, meetings, panels) ─────────────────

export interface NodeChip {
  /** Node ref — "contact:<id>" | "entity:<id>" | "meeting:<id>" | "note:<id>". */
  ref: string
  type: GraphNodeType
  label: string
}

/**
 * Resolve the outgoing edges of the given source nodes into labelled chips,
 * batched (one query per referenced model). Keyed by source node ref; capped
 * per source, heaviest edges first. Sequential — small Prisma pool.
 */
export async function outgoingChips(
  userId: string,
  fromNodes: string[],
  capPerSource = 8,
): Promise<Map<string, NodeChip[]>> {
  const out = new Map<string, NodeChip[]>()
  if (!fromNodes.length) return out

  const edges = await prisma.graphEdge.findMany({
    where: { userId, fromNode: { in: fromNodes } },
    orderBy: { weight: 'desc' },
    select: { fromNode: true, toNode: true },
  })
  if (!edges.length) return out

  const entityIds = new Set<string>()
  const contactIds = new Set<string>()
  for (const e of edges) {
    if (e.toNode.startsWith('entity:')) entityIds.add(e.toNode.slice('entity:'.length))
    else if (e.toNode.startsWith('contact:')) contactIds.add(e.toNode.slice('contact:'.length))
  }

  const entities = entityIds.size
    ? await prisma.graphEntity.findMany({
        where: { id: { in: [...entityIds] }, userId },
        select: { id: true, type: true, name: true },
      })
    : []
  const contacts = contactIds.size
    ? await prisma.contact.findMany({
        where: { id: { in: [...contactIds] }, userId },
        select: { id: true, name: true },
      })
    : []
  const entityById = new Map(entities.map((e) => [e.id, e]))
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  for (const e of edges) {
    const list = out.get(e.fromNode) ?? []
    if (list.length >= capPerSource || list.some((c) => c.ref === e.toNode)) continue
    if (e.toNode.startsWith('entity:')) {
      const entity = entityById.get(e.toNode.slice('entity:'.length))
      if (entity) list.push({ ref: e.toNode, type: entity.type as GraphNodeType, label: entity.name })
    } else if (e.toNode.startsWith('contact:')) {
      const contact = contactById.get(e.toNode.slice('contact:'.length))
      if (contact) list.push({ ref: e.toNode, type: 'PERSON', label: contact.name })
    }
    out.set(e.fromNode, list)
  }
  return out
}

// ── Mini-graph previews for /clients ─────────────────────────────────────────

export interface MiniGraphNeighbor {
  id: string
  type: 'COMPANY' | 'TOPIC'
  label: string
}

/**
 * Per-contact one-hop neighbor lists (companies + topics), for the static radial
 * mini-graph on /clients. One batched pass over the user's edges + entities —
 * no per-contact query. Keyed by contact id; capped at ~6 neighbors each,
 * heaviest first.
 */
export async function getClientGraphPreviews(userId: string): Promise<Map<string, MiniGraphNeighbor[]>> {
  const edges = await prisma.graphEdge.findMany({
    where: { userId, fromNode: { startsWith: 'contact:' } },
    orderBy: { weight: 'desc' },
    select: { fromNode: true, toNode: true },
  })
  if (!edges.length) return new Map()

  const entities = await prisma.graphEntity.findMany({
    where: { userId },
    select: { id: true, type: true, name: true },
  })
  const entityById = new Map(entities.map((e) => [e.id, e]))

  const byContact = new Map<string, MiniGraphNeighbor[]>()
  for (const e of edges) {
    if (!e.toNode.startsWith('entity:')) continue
    const contactId = e.fromNode.slice('contact:'.length)
    const entity = entityById.get(e.toNode.slice('entity:'.length))
    if (!entity) continue
    const list = byContact.get(contactId) ?? []
    if (list.length >= 6) continue
    if (list.some((n) => n.id === e.toNode)) continue
    list.push({ id: e.toNode, type: entity.type as 'COMPANY' | 'TOPIC', label: entity.name })
    byContact.set(contactId, list)
  }
  return byContact
}
