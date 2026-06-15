'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowDownWideNarrow, ChevronDown, Clock, Loader, Plug, Search, Sparkles, TriangleAlert } from 'lucide-react'
import ConversationList, { type ConversationSummary } from './ConversationList'
import InboxFilters, { type CatFilter, type Filter } from './InboxFilters'
import { EMAIL_CATEGORIES, isEmailCategory } from '@/lib/categories'
import { compactAgo } from '@/lib/time'
import type { EmailCategory, SearchResponse, SearchResultItem } from '@/types'

export type InboxGroup = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  label: string
  conversations: ConversationSummary[]
}

type Sort = 'priority' | 'recent'

const SEARCH_MIN_CHARS = 2
const SEARCH_DEBOUNCE_MS = 350

function isFilter(v: string | null): v is Filter {
  return v === 'ALL' || v === 'HOT' || v === 'ATTENTION' || v === 'AWAITING'
}

function isCatFilter(v: string | null): v is CatFilter {
  return v === 'ALL' || isEmailCategory(v)
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

type SearchState = 'idle' | 'loading' | 'done' | 'error'

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

  // Filters/search initialise from the URL so the state survives reloads and
  // navigation into a thread and back.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [filter, setFilter] = useState<Filter>(() => {
    const f = searchParams.get('f')
    return isFilter(f) ? f : 'ALL'
  })
  const [catFilter, setCatFilter] = useState<CatFilter>(() => {
    const c = searchParams.get('c')
    return isCatFilter(c) ? c : 'ALL'
  })
  const [sort, setSort] = useState<Sort>(() => (searchParams.get('sort') === 'recent' ? 'recent' : 'priority'))
  // Single-open accordion: only one mailbox group is expanded at a time.
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null)

  // Server-side AI search (hybrid keyword + semantic via /api/search).
  const [results, setResults] = useState<SearchResultItem[] | null>(null)
  const [searchMeta, setSearchMeta] = useState<SearchResponse['meta'] | null>(null)
  const [searchState, setSearchState] = useState<SearchState>('idle')

  const q = query.trim()
  const serverSearch = q.length >= SEARCH_MIN_CHARS
  const filtering = filter !== 'ALL' || catFilter !== 'ALL'

  // Persist q/f/c/sort in the URL without triggering a server re-render.
  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (filter !== 'ALL') params.set('f', filter)
    if (catFilter !== 'ALL') params.set('c', catFilter)
    if (sort !== 'priority') params.set('sort', sort)
    const qs = params.toString()
    window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`)
  }, [q, filter, catFilter, sort, pathname])

  // Debounced search request. No synchronous setState in the effect body —
  // stale results/meta are simply ignored by the render gates below when the
  // query is cleared, so no reset pass is needed.
  useEffect(() => {
    if (!serverSearch) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setSearchState('loading')
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`search ${res.status}`)
        const data = (await res.json()) as SearchResponse
        setResults(data.items)
        setSearchMeta(data.meta)
        setSearchState('done')
      } catch {
        if (!ctrl.signal.aborted) {
          setResults(null)
          setSearchMeta(null)
          setSearchState('error')
        }
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, serverSearch])

  // Counts for the priority chips — scoped to the active category tab so the
  // numbers match what's actually shown.
  const counts = useMemo(() => {
    const all = groups.flatMap(g => g.conversations).filter(c => matchesCategory(c, catFilter))
    return {
      ALL: all.length,
      HOT: all.filter(c => c.priority === 'HOT').length,
      ATTENTION: all.filter(c => c.priority === 'ATTENTION').length,
      AWAITING: all.filter(c => c.awaitingReply).length,
    }
  }, [groups, catFilter])

  // Counts for the category tabs (across all mailboxes).
  const catCounts = useMemo(() => {
    const all = groups.flatMap(g => g.conversations)
    const out = { ALL: all.filter(c => c.category !== 'SPAM').length } as Record<CatFilter, number>
    for (const cat of EMAIL_CATEGORIES) out[cat] = all.filter(c => c.category === cat).length
    return out
  }, [groups])

  // Browse mode (no query) and the local fallback when /api/search errors.
  const localFallback = serverSearch && searchState === 'error'
  const visible = useMemo(() => {
    return groups
      .map(g => {
        let convs = g.conversations
        if (localFallback && q) {
          const lq = q.toLowerCase()
          convs = convs.filter(c =>
            c.contact.name.toLowerCase().includes(lq) ||
            (c.contact.email ?? '').toLowerCase().includes(lq) ||
            (c.subject ?? '').toLowerCase().includes(lq) ||
            (c.lastMessage ?? '').toLowerCase().includes(lq),
          )
        }
        // Category tab always applies (so Spam stays out of "All mail").
        convs = convs.filter(c => matchesCategory(c, catFilter))
        if (filter !== 'ALL') convs = convs.filter(c => matchesFilter(c, filter))
        return { ...g, conversations: sortConvs(convs, sort) }
      })
      .filter(g => (localFallback || filtering ? g.conversations.length > 0 : true))
  }, [groups, q, filter, catFilter, sort, filtering, localFallback])

  // Search results, post-filtered by the active chips (search + filters combine).
  const filteredResults = useMemo(() => {
    if (!results) return null
    return results
      .filter(r => matchesCategory(r, catFilter) && matchesFilter(r, filter))
      .map(resultToSummary)
  }, [results, filter, catFilter])

  // Server mode keeps stale results on screen while the next query loads —
  // the badge spins instead of the list flashing a skeleton.
  const serverMode = serverSearch && searchState !== 'error'
  const showServerResults = serverMode && filteredResults !== null && filteredResults.length > 0
  const serverLoading =
    serverMode && (filteredResults === null || (filteredResults.length === 0 && searchState === 'loading'))
  const serverEmpty = serverMode && searchState === 'done' && filteredResults !== null && filteredResults.length === 0
  const searching = serverSearch || (localFallback && q.length > 0)
  const nothingMatches =
    serverEmpty ||
    (!serverMode && filtering && visible.length === 0) ||
    (localFallback && q.length > 0 && visible.length === 0)

  const aiBadge = (() => {
    if (!serverSearch) {
      return (
        <span className="inbox-search-badge" title="AI search: type to search across contacts, subjects, messages and meaning">
          <Sparkles size={10} /> AI
        </span>
      )
    }
    if (searchState === 'loading') {
      return (
        <span className="inbox-search-badge" title="Searching…">
          <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Searching
        </span>
      )
    }
    if (searchState === 'error') {
      return (
        <span className="inbox-search-badge" title="AI search is unreachable — falling back to basic text filtering" style={{ color: 'var(--attention)' }}>
          <TriangleAlert size={10} /> Basic
        </span>
      )
    }
    const semantic = searchMeta?.mode === 'hybrid'
    return (
      <span
        className="inbox-search-badge"
        title={semantic ? 'Ranked by meaning + keywords (semantic search active)' : 'Ranked by keywords — semantic index is still building'}
      >
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

        {/* AI search — server-side hybrid (keyword + semantic) via /api/search */}
        <div className="inbox-search">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
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
              counts={counts}
              catCounts={catCounts}
            />
            {!showServerResults && (
              <button
                type="button"
                className="inbox-sort-btn"
                onClick={() => setSort(s => (s === 'priority' ? 'recent' : 'priority'))}
                title={sort === 'priority' ? 'Sorted by priority — click for newest first' : 'Sorted by newest — click for priority first'}
              >
                {sort === 'priority' ? <ArrowDownWideNarrow size={13} /> : <Clock size={13} />}
                {sort === 'priority' ? 'Priority' : 'Newest'}
              </button>
            )}
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
              {searching ? `No matches for “${q}”` : 'Nothing here'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>
              {searching
                ? searchMeta?.parsedFilters?.keywords?.length
                  ? `AI looked for: ${searchMeta.parsedFilters.keywords.join(', ')}. Try different wording or clear the filter.`
                  : 'Try a different name, subject or phrase.'
                : 'No conversations at this priority right now.'}
            </p>
          </div>
        ) : showServerResults && filteredResults ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px 4px', fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600 }}>
                {filteredResults.length} result{filteredResults.length === 1 ? '' : 's'}
              </span>
              <span>· ranked by relevance</span>
              {searchMeta && <span style={{ marginLeft: 'auto' }}>{searchMeta.tookMs}ms</span>}
            </div>
            <ConversationList conversations={filteredResults} />
          </>
        ) : (
          visible.map(g => {
            const open = searching || filtering || openId === g.id
            return (
              <div key={g.id}>
                <button
                  type="button"
                  className="inbox-group-head"
                  aria-expanded={open}
                  onClick={() => setOpenId(prev => (prev === g.id ? null : g.id))}
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
