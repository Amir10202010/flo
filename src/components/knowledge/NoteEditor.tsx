'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Trash2 } from 'lucide-react'
import type { NoteDetail } from '@/services/note.knowledge.service'
import EntityChip from './EntityChip'

/**
 * The knowledge note editor — a quiet document surface. Autosaves ~800ms after
 * the last keystroke; while the auto-link pass runs, the footer shows
 * "Linking…" and the entity chips fade in when it lands. No manual tagging
 * anywhere: people, companies and topics link themselves.
 */

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const AUTOSAVE_MS = 800
const LINK_POLL_MS = 2500
const LINK_POLL_MAX = 24 // ≈1 min of polling before we stop quietly

export default function NoteEditor({ initial }: { initial: NoteDetail }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [linked, setLinked] = useState(initial.linked)
  const [linking, setLinking] = useState(initial.pendingLink)
  const [deleting, setDeleting] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ title: initial.title, body: initial.body })
  const persisted = useRef({ title: initial.title, body: initial.body })
  const pollCount = useRef(0)

  // Auto-grow the textarea to its content (document feel, no inner scrollbar).
  const autogrow = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(() => autogrow(), [autogrow, body])

  const save = useCallback(async () => {
    const { title: t, body: b } = latest.current
    if (t === persisted.current.title && b === persisted.current.body) {
      setSaveState('saved')
      return
    }
    setSaveState('saving')
    try {
      const res = await fetch(`/api/notes/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, body: b }),
      })
      if (!res.ok) throw new Error(`save failed (${res.status})`)
      const data = (await res.json()) as { pendingLink: boolean }
      persisted.current = { title: t, body: b }
      // Content may have changed again mid-flight — then stay dirty and requeue.
      if (latest.current.title !== t || latest.current.body !== b) {
        setSaveState('dirty')
      } else {
        setSaveState('saved')
      }
      if (data.pendingLink) {
        pollCount.current = 0
        setLinking(true)
      }
    } catch {
      setSaveState('error')
    }
  }, [initial.id])

  const queueSave = useCallback(
    (next: { title?: string; body?: string }) => {
      latest.current = { ...latest.current, ...next }
      setSaveState('dirty')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(save, AUTOSAVE_MS)
    },
    [save],
  )

  // Flush on unmount / tab hide so a quick navigation never loses keystrokes.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void save()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [save])

  // While the auto-link pass is pending, poll lightly for the fresh chips.
  useEffect(() => {
    if (!linking) return
    const timer = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > LINK_POLL_MAX) {
        setLinking(false)
        return
      }
      try {
        const res = await fetch(`/api/notes/${initial.id}`)
        if (!res.ok) return
        const data = (await res.json()) as NoteDetail
        if (!data.pendingLink) {
          setLinked(data.linked)
          setLinking(false)
        }
      } catch {
        /* transient — next tick retries */
      }
    }, LINK_POLL_MS)
    return () => clearInterval(timer)
  }, [linking, initial.id])

  async function handleDelete() {
    if (!window.confirm('Delete this note? Its knowledge links are removed too.')) return
    setDeleting(true)
    const res = await fetch(`/api/notes/${initial.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/knowledge/notes')
      router.refresh()
    } else {
      setDeleting(false)
    }
  }

  const status =
    saveState === 'error'
      ? 'Couldn’t save — check your connection'
      : saveState === 'saving' || saveState === 'dirty'
        ? 'Saving…'
        : 'Saved'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Link href="/knowledge/notes" className="kn-back">
          <ArrowLeft size={13} />
          Notes
        </Link>
        <span style={{ flex: 1 }} />
        <span
          aria-live="polite"
          style={{ fontSize: 11.5, color: saveState === 'error' ? 'var(--hot)' : 'var(--text-muted)' }}
        >
          {status}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete note"
          title="Delete note"
          className="kn-icon-btn"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Document */}
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          queueSave({ title: e.target.value })
        }}
        placeholder="Untitled"
        aria-label="Note title"
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 24,
          fontWeight: 650,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          padding: 0,
          width: '100%',
        }}
      />
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          queueSave({ body: e.target.value })
        }}
        placeholder="Write anything — people, companies and topics link themselves."
        aria-label="Note body"
        rows={6}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'none',
          fontSize: 15,
          lineHeight: 1.75,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          padding: 0,
          marginTop: 14,
          width: '100%',
          minHeight: 180,
          overflow: 'hidden',
        }}
      />

      {/* Knowledge strip */}
      <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 28, paddingTop: 14, paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: linked.length || linking ? 10 : 0 }}>
          <span className="kn-strip-label">Linked</span>
          {linking && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <Sparkles size={11} style={{ color: 'var(--accent)' }} className="kn-pulse" />
              Linking…
            </span>
          )}
        </div>
        {linked.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <AnimatePresence initial={false}>
              {linked.map((c) => (
                <motion.span
                  key={c.ref}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'inline-flex' }}
                >
                  <EntityChip nodeRef={c.ref} type={c.type} label={c.label} />
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          !linking && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              People, companies and topics are linked automatically when you save.
            </p>
          )
        )}
      </div>
    </div>
  )
}
