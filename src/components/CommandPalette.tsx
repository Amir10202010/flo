'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bot,
  ChartColumn,
  CircleCheck,
  CornerDownLeft,
  Inbox,
  LayoutDashboard,
  Mail,
  Pencil,
  Plug,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Snowflake,
  Users,
} from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import type { ConversationListItem, SearchResponse, SearchResultItem } from '@/types'
import ContactAvatar from '@/components/dashboard/ContactAvatar'

interface PaletteEntry {
  id: string
  group: 'Pages' | 'Actions' | 'Conversations'
  label: string
  hint?: string
  icon: React.ReactNode
  keywords: string
  run: () => void | Promise<void>
}

const PAGES: { href: string; label: string; icon: React.ReactNode; keywords: string }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} />, keywords: 'home overview command center' },
  { href: '/inbox', label: 'Inbox', icon: <Inbox size={15} />, keywords: 'mail conversations threads' },
  { href: '/clients', label: 'Contacts', icon: <Users size={15} />, keywords: 'contacts directory clients people' },
  { href: '/graph', label: 'Knowledge Graph', icon: <Share2 size={15} />, keywords: 'graph network relationships companies topics entities' },
  { href: '/dashboard?tab=trends', label: 'Trends', icon: <ChartColumn size={15} />, keywords: 'analytics charts metrics response time volume' },
  { href: '/settings', label: 'Settings', icon: <Settings size={15} />, keywords: 'account profile plan' },
]

function matches(q: string, label: string, keywords: string): number {
  if (!q) return 1
  const l = label.toLowerCase()
  const k = keywords.toLowerCase()
  if (l.startsWith(q)) return 3
  if (l.includes(q)) return 2
  if (k.includes(q)) return 1
  return 0
}

/**
 * Global ⌘K / Ctrl+K command palette: navigate the workspace, trigger a Gmail
 * sync, and jump straight into any conversation. The dialog component mounts
 * fresh on every open, so its local state (query, selection) resets for free;
 * the fetched conversation list is cached here across opens.
 */
export default function CommandPalette() {
  const reduced = useReducedMotion()
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const toggle = useUiStore((s) => s.togglePalette)
  const [convs, setConvs] = useState<ConversationListItem[] | null>(null)

  // Global shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  // Lazy-load the conversation list once per session (on first open).
  useEffect(() => {
    if (!open || convs !== null) return
    let alive = true
    fetch('/api/conversations?limit=50')
      .then((r) => (r.ok ? r.json() : []))
      .then((items: ConversationListItem[]) => {
        if (alive) setConvs(Array.isArray(items) ? items : [])
      })
      .catch(() => {
        if (alive) setConvs([])
      })
    return () => {
      alive = false
    }
  }, [open, convs])

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const close = useCallback(() => setOpen(false), [setOpen])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="cmdk-overlay"
            onClick={close}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          />
          <PaletteDialog convs={convs} onClose={close} reduced={Boolean(reduced)} />
        </>
      )}
    </AnimatePresence>
  )
}

function PaletteDialog({
  convs,
  onClose,
  reduced,
}: {
  convs: ConversationListItem[] | null
  onClose: () => void
  reduced: boolean
}) {
  const router = useRouter()
  const setComposeOpen = useUiStore((s) => s.setComposeOpen)
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen)
  const setAlertsOpen = useUiStore((s) => s.setAlertsOpen)
  const [query, setQuery] = useState('')
  const [rawIndex, setRawIndex] = useState(0)
  const [syncState, setSyncState] = useState<'idle' | 'starting' | 'started' | 'failed'>('idle')
  const listRef = useRef<HTMLDivElement>(null)

  // Server-side AI search for the Conversations group. Falls back to the
  // locally cached list (substring match) when the request fails.
  const [aiResults, setAiResults] = useState<SearchResultItem[] | null>(null)
  const [aiSearching, setAiSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    // Below the threshold the entries memo ignores aiResults — no reset needed.
    if (q.length < 3) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setAiSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`search ${res.status}`)
        const data = (await res.json()) as SearchResponse
        setAiResults(data.items)
      } catch {
        if (!ctrl.signal.aborted) setAiResults(null)
      } finally {
        if (!ctrl.signal.aborted) setAiSearching(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  const go = useCallback(
    (href: string) => {
      onClose()
      router.push(href)
    },
    [onClose, router],
  )

  const startSync = useCallback(async () => {
    if (syncState === 'starting' || syncState === 'started') return
    setSyncState('starting')
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' })
      setSyncState(res.ok ? 'started' : 'failed')
      if (res.ok) setTimeout(onClose, 1100)
    } catch {
      setSyncState('failed')
    }
  }, [onClose, syncState])

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase()

    const pages = PAGES.map((p) => ({ p, score: matches(q, p.label, p.keywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map<PaletteEntry>(({ p }) => ({
        id: `page-${p.href}`,
        group: 'Pages',
        label: p.label,
        icon: p.icon,
        keywords: p.keywords,
        run: () => go(p.href),
      }))

    const syncLabel =
      syncState === 'starting'
        ? 'Starting sync…'
        : syncState === 'started'
          ? 'Sync started — running in background'
          : syncState === 'failed'
            ? 'Sync failed — is Gmail connected?'
            : 'Sync Gmail now'
    const actionDefs: PaletteEntry[] = [
      {
        id: 'action-ask',
        group: 'Actions',
        label: 'Ask Velnox AI',
        icon: <Bot size={15} />,
        keywords: 'assistant ai ask question chat help follow up summarize draft',
        run: () => {
          onClose()
          setAssistantOpen(true)
        },
      },
      {
        id: 'action-alerts',
        group: 'Actions',
        label: 'Who needs a follow-up',
        icon: <Snowflake size={15} />,
        keywords: 'follow up going cold waiting on you relationships slipping remind',
        run: () => {
          onClose()
          setAlertsOpen(true)
        },
      },
      {
        id: 'action-sync',
        group: 'Actions',
        label: syncLabel,
        icon: syncState === 'started' ? <CircleCheck size={15} style={{ color: 'var(--success)' }} /> : <RefreshCw size={15} />,
        keywords: 'refresh import gmail sync',
        run: startSync,
      },
      {
        id: 'action-compose',
        group: 'Actions',
        label: 'Compose new email',
        icon: <Pencil size={15} />,
        keywords: 'write new email compose message send smart',
        run: () => {
          onClose()
          setComposeOpen(true)
        },
      },
      {
        id: 'action-connect',
        group: 'Actions',
        label: 'Connect a channel',
        icon: <Plug size={15} />,
        keywords: 'gmail integration add account',
        run: () => go('/settings?tab=connections'),
      },
    ]
    const actions = actionDefs.filter((a) => matches(q, a.label, a.keywords) > 0)

    // Server AI search results win when available; otherwise substring-match
    // the locally cached list (also the offline/error fallback). The length
    // gate keeps stale results from a longer query out of short-query views.
    const conversations: PaletteEntry[] =
      q.length >= 3 && aiResults !== null
        ? aiResults.map<PaletteEntry>((r) => ({
            id: `conv-${r.id}`,
            group: 'Conversations',
            label: r.contact.name,
            hint: r.subject ?? r.snippet ?? undefined,
            icon: <ContactAvatar name={r.contact.name} size={22} />,
            keywords: '',
            run: () => go(`/inbox/${r.id}`),
          }))
        : (convs ?? [])
            .map((c) => ({
              c,
              score: q
                ? Math.max(
                    matches(q, c.contact.name, c.contact.email ?? ''),
                    matches(q, c.subject ?? '', c.lastMessage ?? ''),
                  )
                : 1,
            }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, q ? 6 : 4)
            .map<PaletteEntry>(({ c }) => ({
              id: `conv-${c.id}`,
              group: 'Conversations',
              label: c.contact.name,
              hint: c.subject ?? c.lastMessage ?? undefined,
              icon: <ContactAvatar name={c.contact.name} size={22} />,
              keywords: '',
              run: () => go(`/inbox/${c.id}`),
            }))

    return [...pages, ...actions, ...conversations]
  }, [query, convs, aiResults, go, startSync, syncState, onClose, setComposeOpen, setAssistantOpen, setAlertsOpen])

  // Clamp at render time instead of syncing state in an effect.
  const index = Math.min(rawIndex, Math.max(0, entries.length - 1))

  // Keep the active row visible (DOM-only side effect).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setRawIndex(Math.min(entries.length - 1, index + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setRawIndex(Math.max(0, index - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      entries[index]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  let lastGroup: string | null = null

  return (
    <motion.div
      className="cmdk-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      initial={reduced ? false : { opacity: 0, scale: 0.98, x: '-50%', y: -8 }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
      exit={{ opacity: 0, scale: 0.98, x: '-50%', y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ x: '-50%' }}
    >
      <div className="cmdk-input-row">
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          autoFocus
          className="cmdk-input"
          placeholder="Search pages, actions, conversations…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setRawIndex(0)
          }}
          onKeyDown={onInputKey}
          aria-label="Command palette search"
        />
        <span className="cmdk-kbd">esc</span>
      </div>

      <div className="cmdk-list" ref={listRef}>
        {entries.length === 0 ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No results for “{query}”
          </div>
        ) : (
          entries.map((entry, i) => {
            const showGroup = entry.group !== lastGroup
            lastGroup = entry.group
            return (
              <div key={entry.id}>
                {showGroup && <div className="cmdk-group">{entry.group}</div>}
                <button
                  type="button"
                  className="cmdk-item"
                  data-active={i === index}
                  data-idx={i}
                  onMouseEnter={() => setRawIndex(i)}
                  onClick={() => entry.run()}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, flexShrink: 0, color: 'inherit' }}>
                    {entry.icon}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.label}
                    {entry.hint && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> — {entry.hint}</span>
                    )}
                  </span>
                  {i === index && <CornerDownLeft size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                </button>
              </div>
            )
          })
        )}
        {convs === null && (
          <div style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Mail size={12} />
            Loading conversations…
          </div>
        )}
        {aiSearching && query.trim().length >= 3 && (
          <div style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Searching with AI…
          </div>
        )}
      </div>

      <div className="cmdk-foot">
        <span><strong>↑↓</strong> navigate</span>
        <span><strong>↵</strong> open</span>
        <span><strong>esc</strong> close</span>
        <span style={{ marginLeft: 'auto' }}>Velnox Command</span>
      </div>
    </motion.div>
  )
}
