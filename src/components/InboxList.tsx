'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Loader, Plug, Search, Sparkles, TriangleAlert } from 'lucide-react'
import ConversationList, { type ConversationSummary } from './ConversationList'
import InboxFilters, { type CatFilter, type Filter, type RiskFilter, type SentFilter, type Sort } from './InboxFilters'
import { EMAIL_CATEGORIES, isEmailCategory } from '@/lib/categories'
import { compactAgo } from '@/lib/time'
import type { ConversationListItem, EmailCategory, SearchResponse, SearchResultItem } from '@/types'

export type InboxGroup = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  label: string
  conversations: ConversationSummary[]
}

const SEARCH_MIN_CHARS = 2
const SEARCH_DEBOUNCE_MS = 350

function isFilter(v: string | null): v is Filter {
  return v === 'ALL' || v === 'HOT' || v === 'ATTENTION' || v === 'AWAITING'
}
function isCatFilter(v: string | null): v is CatFilter {
  return v === 'ALL' || isEmailCategory(v)
}
function isRiskFilter(v: string | null): v is RiskFilter {
  return v === 'ALL' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL'
}
function isSentFilter(v: string | null): v is SentFilter {
  return v === 'ALL' || v === 'POSITIVE' || v === 'NEUTRAL' || v === 'NEGATIVE'
}
function isSort(v: string | null): v is Sort {
  return v === 'priority' || v === 'recent' || v === 'oldest'
}

function matchesFilter(c: { priority: string; awaitingReply?: boolean }, filter: Filter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'AWAITING') return Boolean(c.awaitingReply)
  return c.priority === filter
}

// "All mail" excludes Spam; a specific tab shows exactly that category.
function matchesCategory(c: { category: EmailCategory }, cat: CatFilter): boolean {
  if (cat === 'ALL') return c.category !== 'SPAM'
  return c.category === cat
}

function sortConvs(convs: ConversationSummary[], sort: Sort): ConversationSummary[] {
  const ts = (c: ConversationSummary) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0)
  return [...convs].sort((a, b) =>
    sort === 'recent'
      ? ts(b) - ts(a)
      : sort === 'oldest'
        ? ts(a) - ts(b)
        : b.priorityScore - a.priorityScore || ts(b) - ts(a),
  )
}

function resultToSummary(r: SearchResultItem): ConversationSummary {
  return {
    id: r.id,
    channel: r.channel === 'TELEGRAM' ? 'TELEGRAM' : 'GMAIL',
    subject: r.subject,
    priority: r.priority,
    priorityScore: r.priorityScore,
    category: r.category,
    lastMessageAt: r.lastMessageAt,
    timeLabel: compactAgo(r.lastMessageAt),
    contact: r.contact,
    lastMessage: r.snippet,
    unreadCount: 0,
    awaitingReply: r.awaitingReply,
  }
}

/** Append the priority/awaiting/risk/sentiment params both endpoints understand. */
function appendFilterParams(params: URLSearchParams, filter: Filter, risk: RiskFilter, sentiment: SentFilter) {
  if (filter === 'HOT') params.set('priority', 'HOT')
  else if (filter === 'ATTENTION') params.set('priority', 'ATTENTION')
  else if (filter === 'AWAITING') params.set('awaiting', 'true')
  if (risk !== 'ALL') params.set('risk', risk)
  if (sentiment !== 'ALL') params.set('sentiment', sentiment)
}

function itemToSummary(r: ConversationListItem): ConversationSummary {
  return {
    id: r.id,
    channel: r.channel === 'TELEGRAM' ? 'TELEGRAM' : 'GMAIL',
    subject: r.subject,
    priority: r.priority,
    priorityScore: r.priorityScore,
    category: r.category,
    lastMessageAt: r.lastMessageAt,
    timeLabel: r.timeLabel ?? compactAgo(r.lastMessageAt),
    contact: r.contact,
    lastMessage: r.lastMessage,
    unreadCount: r.unreadCount,
    awaitingReply: r.awaitingReply,
    hasDraft: r.hasDraft,
    nextAction: r.nextAction,
  }
}

type ServerState = 'idle' | 'loading' | 'done' | 'error'

export default function InboxList({
  groups,
  total,
  hasConnection,
}: {
  groups: InboxGroup[]
  total: number
  hasConnection: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filters/search initialise from the URL so state survives reloads + nav.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [filter, setFilter] = useState<Filter>(() => {
    const f = searchParams.get('f')
    return isFilter(f) ? f : 'ALL'
  })
  const [catFilter, setCatFilter] = useState<CatFilter>(() => {
    const c = searchParams.get('c')
    return isCatFilter(c) ? c : 'ALL'
  })
  const [risk, setRisk] = useState<RiskFilter>(() => {
    const r = searchParams.get('risk')
    return isRiskFilter(r) ? r : 'ALL'
  })
  const [sentiment, setSentiment] = useState<SentFilter>(() => {
    const s = searchParams.get('sent')
    return isSentFilter(s) ? s : 'ALL'
  })
  const [sort, setSort] = useState<Sort>(() => {
    const s = searchParams.get('sort')
    return isSort(s) ? s : 'priority'
  })
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null)

  // Unified server fetch (hybrid AI search OR server-side filter/sort).
  const [serverItems, setServerItems] = useState<ConversationSummary[] | null>(null)
  const [serverKind, setServerKind] = useState<'search' | 'filter'>('filter')
  const [searchMeta, setSearchMeta] = useState<SearchResponse['meta'] | null>(null)
  const [serverState, setServerState] = useState<ServerState>('idle')

  const q = query.trim()
  const isSearch = q.length >= SEARCH_MIN_CHARS
  const filtersActive = filter !== 'ALL' || catFilter !== 'ALL' || risk !== 'ALL' || sentiment !== 'ALL'
  const serverMode = isSearch || filtersActive || sort !== 'priority'

  // Persist q/f/c/risk/sent/sort in the URL without a server re-render.
  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (filter !== 'ALL') params.set('f', filter)
    if (catFilter !== 'ALL') params.set('c', catFilter)
    if (risk !== 'ALL') params.set('risk', risk)
    if (sentiment !== 'ALL') params.set('sent', sentiment)
    if (sort !== 'priority') params.set('sort', sort)
    const qs = params.toString()
    window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`)
  }, [q, filter, catFilter, risk, sentiment, sort, pathname])

  // Debounced server request. No synchronous setState in the effect body — when
  // serverMode is false the render gates ignore any stale results.
  useEffect(() => {
    if (!serverMode) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setServerState('loading')
      try {
        if (isSearch) {
          const params = new URLSearchParams({ q, limit: '40' })
          appendFilterParams(params, filter, risk, sentiment)
          const res = await fetch(`/api/search?${params.toString()}`, { signal: ctrl.signal })
          if (!res.ok) throw new Error(`search ${res.status}`)
          const data = (await res.json()) as SearchResponse
          setServerItems(data.items.map(resultToSummary))
          setSearchMeta(data.meta)
          setServerKind('search')
        } else {
          const params = new URLSearchParams({ limit: '100', sort })
          if (catFilter !== 'ALL') params.set('category', catFilter)
          appendFilterParams(params, filter, risk, sentiment)
          const res = await fetch(`/api/conversations?${params.toString()}`, { signal: ctrl.signal })
          if (!res.ok) throw new Error(`filter ${res.status}`)
          const data = (await res.json()) as ConversationListItem[]
          setServerItems(data.map(itemToSummary))
          setSearchMeta(null)
          setServerKind('filter')
        }
        setServerState('done')
      } catch {
        if (!ctrl.signal.aborted) {
          setServerItems(null)
          setSearchMeta(null)
          setServerState('error')
        }
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [serverMode, isSearch, q, filter, catFilter, risk, sentiment, sort])

  // Priority-chip counts — scoped to the active category tab (from loaded data).
  const counts = useMemo(() => {
    const all = groups.flatMap((g) => g.conversations).filter((c) => matchesCategory(c, catFilter))
    return {
      ALL: all.length,
      HOT: all.filter((c) => c.priority === 'HOT').length,
      ATTENTION: all.filter((c) => c.priority === 'ATTENTION').length,
      AWAITING: all.filter((c) => c.awaitingReply).length,
    }
  }, [groups, catFilter])

  const catCounts = useMemo(() => {
    const all = groups.flatMap((g) => g.conversations)
    const out = { ALL: all.filter((c) => c.category !== 'SPAM').length } as Record<CatFilter, number>
    for (const cat of EMAIL_CATEGORIES) out[cat] = all.filter((c) => c.category === cat).length
    return out
  }, [groups])

  // Browse mode (no server fetch) + client fallback when the server errors.
  const serverErrored = serverMode && serverState === 'error'
  const visible = useMemo(() => {
    return groups
      .map((g) => {
        let convs = g.conversations
        if (serverErrored && isSearch && q) {
          const lq = q.toLowerCase()
          convs = convs.filter(
            (c) =>
              c.contact.name.toLowerCase().includes(lq) ||
              (c.contact.email ?? '').toLowerCase().includes(lq) ||
              (c.subject ?? '').toLowerCase().includes(lq) ||
              (c.lastMessage ?? '').toLowerCase().includes(lq),
          )
        }
        convs = convs.filter((c) => matchesCategory(c, catFilter))
        if (filter !== 'ALL') convs = convs.filter((c) => matchesFilter(c, filter))
        return { ...g, conversations: sortConvs(convs, sort) }
      })
      .filter((g) => (serverErrored || filtersActive ? g.conversations.length > 0 : true))
  }, [groups, q, filter, catFilter, sort, filtersActive, serverErrored, isSearch])

  // Server results post-filtered by category (search lacks a category filter;
  // for the filter endpoint, "ALL" drops Spam and a specific tab is a no-op).
  const serverVisible = useMemo(() => {
    if (!serverItems) return null
    return serverItems.filter((c) => matchesCategory(c, catFilter))
  }, [serverItems, catFilter])

  const showServer = serverMode && !serverErrored
  const serverLoading = showServer && (serverVisible === null || (serverState === 'loading' && serverVisible.length === 0))
  const serverReady = showServer && serverState === 'done' && serverVisible !== null
  const serverEmpty = serverReady && serverVisible!.length === 0
  const nothingMatches = serverEmpty || (serverErrored && filtersActive && visible.length === 0) || (serverErrored && isSearch && visible.length === 0)

  const aiBadge = (() => {
    if (!isSearch) {
      return (
        <span className="inbox-search-badge" title="AI search: type to search across contacts, subjects, messages and meaning">
          <Sparkles size={10} /> AI
        </span>
      )
    }
    if (serverState === 'loading') {
      return (
        <span className="inbox-search-badge" title="Searching…">
          <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Searching
        </span>
      )
    }
    if (serverState === 'error') {
      return (
        <span className="inbox-search-badge" title="AI search is unreachable — falling back to basic text filtering" style={{ color: 'var(--attention)' }}>
          <TriangleAlert size={10} /> Basic
        </span>
      )
    }
    const semantic = searchMeta?.mode === 'hybrid'
    return (
      <span className="inbox-search-badge" title={semantic ? 'Ranked by meaning + keywords (semantic search active)' : 'Ranked by keywords — semantic index is still building'}>
        <Sparkles size={10} /> {semantic ? 'AI' : 'Match'}
      </span>
    )
  })()

  return (
    <>
      <div className="inbox-list-header" style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inbox</h1>
          {hasConnection && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total}</span>}
        </div>

        <div className="inbox-search">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search… try “angry clients last week”"
            aria-label="Search conversations"
          />
          {aiBadge}
        </div>

        {hasConnection && (
          <div className="inbox-toolbar">
            <InboxFilters
              filter={filter}
              setFilter={setFilter}
              catFilter={catFilter}
              setCatFilter={setCatFilter}
              risk={risk}
              setRisk={setRisk}
              sentiment={sentiment}
              setSentiment={setSentiment}
              sort={sort}
              setSort={setSort}
              counts={counts}
              catCounts={catCounts}
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasConnection ? (
          <ConnectEmpty />
        ) : serverLoading ? (
          <SearchLoading />
        ) : nothingMatches ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
              {isSearch ? `No matches for “${q}”` : 'Nothing matches these filters'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>
              {isSearch
                ? searchMeta?.parsedFilters?.keywords?.length
                  ? `AI looked for: ${searchMeta.parsedFilters.keywords.join(', ')}. Try different wording or clear filters.`
                  : 'Try a different name, subject or phrase.'
                : 'Try clearing a filter to widen the results.'}
            </p>
          </div>
        ) : serverReady && serverVisible ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px 4px', fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600 }}>
                {serverVisible.length} {serverKind === 'search' ? `result${serverVisible.length === 1 ? '' : 's'}` : `conversation${serverVisible.length === 1 ? '' : 's'}`}
              </span>
              <span>· {serverKind === 'search' ? 'ranked by relevance' : sort === 'oldest' ? 'oldest first' : sort === 'recent' ? 'newest first' : 'by priority'}</span>
              {searchMeta && <span style={{ marginLeft: 'auto' }}>{searchMeta.tookMs}ms</span>}
            </div>
            <ConversationList conversations={serverVisible} />
          </>
        ) : (
          visible.map((g) => {
            const open = serverErrored || filtersActive || openId === g.id
            return (
              <div key={g.id}>
                <button
                  type="button"
                  className="inbox-group-head"
                  aria-expanded={open}
                  onClick={() => setOpenId((prev) => (prev === g.id ? null : g.id))}
                >
                  <span className="inbox-group-dot" style={{ background: g.channel === 'GMAIL' ? '#EA4335' : 'var(--accent)' }} />
                  <span className="inbox-group-label">{g.label}</span>
                  <span className="inbox-group-count">{g.conversations.length}</span>
                  <ChevronDown size={15} className="inbox-group-chevron" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                </button>
                {open && <ConversationList conversations={g.conversations} />}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function SearchLoading() {
  return (
    <div style={{ padding: '8px 0' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="conv-item" style={{ pointerEvents: 'none' }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="skeleton" style={{ height: 11, width: '50%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 10, width: '85%', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ConnectEmpty() {
  return (
    <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <Plug size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No channels connected yet</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 240 }}>
          Connect Gmail to pull your conversations into Velnox and start prioritising them.
        </p>
      </div>
      <Link href="/integrations" className="btn-primary" style={{ fontSize: 13.5, padding: '9px 18px', textDecoration: 'none' }}>
        Connect a channel
      </Link>
    </div>
  )
}
