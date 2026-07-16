import { prisma } from '@/lib/prisma'
import { contactNode, entityNode, resolveChips, type NodeChip } from './graph.service'

/**
 * Knowledge recall for the assistant — when a question names people, companies
 * or topics the graph knows, their connections and recorded facts are injected
 * into the briefing (so "what did we discuss with John about pricing?" answers
 * from memory, not just the dashboard), and returned as related-entity chips
 * for the chat's knowledge rail.
 *
 * Cheap by design: one candidate load, one pure text match, then 3–4 batched
 * queries for the matched nodes only. Everything degrades to an empty recall.
 */

export interface KnowledgeRecall {
  /** Lines for the briefing's KNOWLEDGE section (empty → omit the section). */
  briefingLines: string[]
  /** Matched + closely connected nodes, for the chat knowledge rail. */
  related: NodeChip[]
  /** Whitelist additions the model may cite. */
  sourceEntries: { href: string; label: string }[]
}

export const EMPTY_RECALL: KnowledgeRecall = { briefingLines: [], related: [], sourceEntries: [] }

// ── Pure matching (unit-tested by scripts/knowledge.check.ts) ────────────────

export interface MatchCandidate {
  ref: string
  label: string
  weight: number
  /** PERSON candidates also match on individual name tokens ("John" → "John Smith"). */
  person?: boolean
}

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)

/**
 * Which candidates does this text mention? Full-label substring matches always
 * count; single name tokens count for people only (topic words like "email"
 * would over-match otherwise). Returns refs, strongest match first.
 */
export function matchNodesInText(text: string, candidates: MatchCandidate[], cap = 4): string[] {
  const norm = ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
  if (norm.trim().length < 3) return []
  const textTokens = new Set(tokenize(text))

  const scored: { ref: string; score: number }[] = []
  for (const c of candidates) {
    const label = c.label
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (label.length < 3) continue

    if (norm.includes(` ${label} `)) {
      scored.push({ ref: c.ref, score: label.length * 3 + c.weight })
      continue
    }
    if (c.person) {
      const nameTokens = label.split(' ').filter((t) => t.length >= 3)
      if (nameTokens.some((t) => textTokens.has(t))) {
        scored.push({ ref: c.ref, score: 4 + c.weight })
      }
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((s) => s.ref)
}

// ── Recall ───────────────────────────────────────────────────────────────────

const FACT_LABEL: Record<string, string> = {
  DECISION: 'decision',
  ACTION_ITEM: 'action item',
  RISK: 'risk',
}

export async function recallKnowledge(userId: string, question: string): Promise<KnowledgeRecall> {
  try {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, name: true },
    })
    const entities = await prisma.graphEntity.findMany({
      where: { userId },
      orderBy: { weight: 'desc' },
      take: 400,
      select: { id: true, name: true, weight: true },
    })

    const candidates: MatchCandidate[] = [
      ...contacts.map((c) => ({ ref: contactNode(c.id), label: c.name, weight: 5, person: true })),
      ...entities.map((e) => ({ ref: entityNode(e.id), label: e.name, weight: Math.min(10, e.weight) })),
    ]
    const matched = matchNodesInText(question, candidates)
    if (!matched.length) return EMPTY_RECALL

    // Neighbors of every matched node in one query.
    const edges = await prisma.graphEdge.findMany({
      where: { userId, OR: [{ fromNode: { in: matched } }, { toNode: { in: matched } }] },
      orderBy: { weight: 'desc' },
      take: 120,
      select: { fromNode: true, toNode: true },
    })
    const neighborsOf = new Map<string, string[]>()
    for (const e of edges) {
      for (const [self, other] of [
        [e.fromNode, e.toNode],
        [e.toNode, e.fromNode],
      ] as const) {
        if (!matched.includes(self) || matched.includes(other)) continue
        const list = neighborsOf.get(self) ?? []
        if (list.length < 6 && !list.includes(other)) {
          list.push(other)
          neighborsOf.set(self, list)
        }
      }
    }

    const allRefs = [...new Set([...matched, ...[...neighborsOf.values()].flat()])]
    const chips = await resolveChips(userId, allRefs)
    const chipByRef = new Map(chips.map((c) => [c.ref, c]))

    const facts = await prisma.knowledgeFact.findMany({
      where: { userId, aboutNode: { in: matched } },
      orderBy: { happenedAt: 'desc' },
      take: 8,
      select: { kind: true, text: true, aboutNode: true, happenedAt: true },
    })

    const lines: string[] = []
    const sourceEntries: { href: string; label: string }[] = []
    for (const ref of matched) {
      const chip = chipByRef.get(ref)
      if (!chip) continue
      const href = `/knowledge?focus=${ref}`
      sourceEntries.push({ href, label: `${chip.label} · knowledge` })
      const neighborLabels = (neighborsOf.get(ref) ?? [])
        .map((r) => chipByRef.get(r))
        .filter((c): c is NodeChip => Boolean(c))
        .map((c) => `${c.label} (${c.type.toLowerCase()})`)
      lines.push(`- ${chip.label} (${chip.type.toLowerCase()}) [${href}]`)
      if (neighborLabels.length) lines.push(`  connected to: ${neighborLabels.join(', ')}`)
      const ownFacts = facts.filter((f) => f.aboutNode === ref).slice(0, 3)
      for (const f of ownFacts) {
        lines.push(`  ${FACT_LABEL[f.kind] ?? f.kind} (${f.happenedAt.toISOString().slice(0, 10)}): ${f.text}`)
      }
    }
    if (!lines.length) return EMPTY_RECALL

    // Rail chips: matched nodes first, then their strongest neighbors.
    const related: NodeChip[] = []
    for (const ref of matched) {
      const c = chipByRef.get(ref)
      if (c) related.push(c)
    }
    for (const refs of neighborsOf.values()) {
      for (const r of refs.slice(0, 2)) {
        const c = chipByRef.get(r)
        if (c && !related.some((x) => x.ref === c.ref) && related.length < 8) related.push(c)
      }
    }

    return { briefingLines: lines, related, sourceEntries }
  } catch (err) {
    console.warn('[assistant] knowledge recall failed (continuing without):', String(err))
    return EMPTY_RECALL
  }
}
