import { prisma } from '@/lib/prisma'
import { shortDate } from '@/lib/time'
import { embedTexts, getEmbeddingProvider } from './ai'
import { bufferToVector } from './embedding.service'
import { cosine, tokenize } from './search.ranking'
import { contactNode, entityNode } from './graph.service'
import type { KnowledgeHit } from '@/types'

/**
 * Knowledge search — entities, meetings and notes beside the conversation
 * results. Keyword matches run over names/titles/bodies in SQL; notes and
 * meetings additionally recall semantically via their KnowledgeEmbedding
 * vectors (same in-process cosine as conversations). Degrades to keyword-only
 * without an embedding provider, and to nothing on error — search never
 * breaks because the knowledge layer hiccuped.
 */

const SEMANTIC_CUTOFF = 0.55
const SEMANTIC_UNIVERSE = 150

// ── Pure scoring (unit-tested by scripts/knowledge.check.ts) ─────────────────

/** 3 = exact label, 2 = a whole word matches, 1 = substring; summed per term. */
export function scoreLabelMatch(label: string, terms: string[]): number {
  const norm = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!norm) return 0
  const words = new Set(norm.split(' '))
  let score = 0
  for (const term of terms) {
    if (norm === term) score += 3
    else if (words.has(term)) score += 2
    else if (norm.includes(term)) score += 1
  }
  return score
}

// ── Search ───────────────────────────────────────────────────────────────────

function noteLabel(title: string, body: string): string {
  return title.trim() || body.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Note'
}

export async function searchKnowledge(userId: string, query: string, limit = 8): Promise<KnowledgeHit[]> {
  const terms = tokenize(query).slice(0, 8)
  if (!terms.length) return []

  try {
    const byRef = new Map<string, KnowledgeHit>()
    const add = (hit: KnowledgeHit) => {
      const existing = byRef.get(hit.ref)
      if (!existing || hit.score > existing.score) byRef.set(hit.ref, hit)
    }
    const contains = (field: string) => terms.map((t) => ({ [field]: { contains: t, mode: 'insensitive' as const } }))

    // Entities (companies + topics) — names are short, keyword only.
    const entities = await prisma.graphEntity.findMany({
      where: { userId, OR: contains('name') },
      orderBy: { weight: 'desc' },
      take: 30,
      select: { id: true, type: true, name: true, canonicalKey: true, weight: true },
    })
    for (const e of entities) {
      const kw = scoreLabelMatch(e.name, terms)
      if (!kw) continue
      const ref = entityNode(e.id)
      add({
        ref,
        type: e.type,
        label: e.name,
        sublabel: e.type === 'COMPANY' && !e.canonicalKey.startsWith('name:') ? e.canonicalKey : null,
        href: `/knowledge?focus=${ref}`,
        score: kw * 2 + Math.min(10, e.weight) * 0.1,
      })
    }

    // People.
    const contacts = await prisma.contact.findMany({
      where: { userId, OR: [...contains('name'), ...contains('email')] },
      take: 15,
      select: { id: true, name: true, email: true },
    })
    for (const c of contacts) {
      const kw = Math.max(scoreLabelMatch(c.name, terms), c.email ? scoreLabelMatch(c.email, terms) : 0)
      if (!kw) continue
      const ref = contactNode(c.id)
      add({ ref, type: 'PERSON', label: c.name, sublabel: c.email, href: `/knowledge?focus=${ref}`, score: kw * 2 + 0.5 })
    }

    // Meetings + notes — keyword…
    const meetings = await prisma.meeting.findMany({
      where: { userId, OR: contains('title') },
      orderBy: { startsAt: 'desc' },
      take: 15,
      select: { id: true, title: true, startsAt: true },
    })
    for (const m of meetings) {
      const kw = scoreLabelMatch(m.title, terms)
      if (!kw) continue
      add({
        ref: `meeting:${m.id}`,
        type: 'MEETING',
        label: m.title,
        sublabel: shortDate(m.startsAt),
        href: `/meetings/${m.id}`,
        score: kw * 2,
      })
    }
    const notes = await prisma.note.findMany({
      where: { userId, OR: [...contains('title'), ...contains('body')] },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: { id: true, title: true, body: true },
    })
    for (const n of notes) {
      const kw = Math.max(scoreLabelMatch(n.title, terms), scoreLabelMatch(n.body.slice(0, 2000), terms) * 0.6)
      if (!kw) continue
      add({
        ref: `note:${n.id}`,
        type: 'NOTE',
        label: noteLabel(n.title, n.body),
        sublabel: 'note',
        href: `/knowledge/notes/${n.id}`,
        score: kw * 1.8,
      })
    }

    // …plus semantic recall over note/meeting vectors.
    const provider = getEmbeddingProvider()
    if (provider) {
      try {
        const embedded = await embedTexts([query], 'query')
        if (embedded) {
          const queryVec = embedded.vectors[0]
          const noteIds = (
            await prisma.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: SEMANTIC_UNIVERSE, select: { id: true } })
          ).map((n) => n.id)
          const meetingIds = (
            await prisma.meeting.findMany({ where: { userId }, orderBy: { startsAt: 'desc' }, take: SEMANTIC_UNIVERSE, select: { id: true } })
          ).map((m) => m.id)
          const vectors = await prisma.knowledgeEmbedding.findMany({
            where: {
              model: provider.embeddingModel,
              OR: [
                { sourceType: 'note', sourceId: { in: noteIds } },
                { sourceType: 'meeting', sourceId: { in: meetingIds } },
              ],
            },
            select: { sourceType: true, sourceId: true, vector: true, dims: true },
          })
          const semantic: { sourceType: string; sourceId: string; sim: number }[] = []
          for (const v of vectors) {
            if (v.dims !== queryVec.length) continue
            const sim = cosine(queryVec, bufferToVector(v.vector))
            if (sim >= SEMANTIC_CUTOFF) semantic.push({ sourceType: v.sourceType, sourceId: v.sourceId, sim })
          }
          // Hydrate semantic-only hits that the keyword pass didn't load.
          const missingNoteIds = semantic
            .filter((s) => s.sourceType === 'note' && !byRef.has(`note:${s.sourceId}`))
            .map((s) => s.sourceId)
          const missingMeetingIds = semantic
            .filter((s) => s.sourceType === 'meeting' && !byRef.has(`meeting:${s.sourceId}`))
            .map((s) => s.sourceId)
          const semNotes = missingNoteIds.length
            ? await prisma.note.findMany({ where: { id: { in: missingNoteIds }, userId }, select: { id: true, title: true, body: true } })
            : []
          const semMeetings = missingMeetingIds.length
            ? await prisma.meeting.findMany({ where: { id: { in: missingMeetingIds }, userId }, select: { id: true, title: true, startsAt: true } })
            : []
          const semNoteById = new Map(semNotes.map((n) => [n.id, n]))
          const semMeetingById = new Map(semMeetings.map((m) => [m.id, m]))

          for (const s of semantic) {
            const ref = `${s.sourceType}:${s.sourceId}`
            const existing = byRef.get(ref)
            if (existing) {
              existing.score += s.sim * 2
              continue
            }
            if (s.sourceType === 'note') {
              const n = semNoteById.get(s.sourceId)
              if (n) {
                add({ ref, type: 'NOTE', label: noteLabel(n.title, n.body), sublabel: 'note', href: `/knowledge/notes/${n.id}`, score: s.sim * 3 })
              }
            } else {
              const m = semMeetingById.get(s.sourceId)
              if (m) {
                add({ ref, type: 'MEETING', label: m.title, sublabel: shortDate(m.startsAt), href: `/meetings/${m.id}`, score: s.sim * 3 })
              }
            }
          }
        }
      } catch (err) {
        console.warn('[knowledge-search] semantic pass failed, keyword-only:', String(err))
      }
    }

    return [...byRef.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  } catch (err) {
    console.warn('[knowledge-search] failed (returning none):', String(err))
    return []
  }
}
