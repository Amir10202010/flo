'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import type { KnowledgeGraph } from '@/services/graph.service'
import GraphCanvas from '@/components/graph/GraphCanvas'
import KnowledgePanel from './KnowledgePanel'
import KnowledgeBrowse from './KnowledgeBrowse'

/**
 * The Knowledge experience — owns selection and the desktop/mobile split.
 * Desktop: living canvas + context panel. Mobile: browse-first list + a
 * full-height context sheet (never a shrunken canvas). Selection syncs to
 * ?focus= so any node view is linkable, without re-running the server tree.
 */

function useIsNarrow(threshold = 768): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${threshold - 1}px)`)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [threshold])
  return narrow
}

export default function KnowledgeExplorer({
  graph,
  initialFocus,
}: {
  graph: KnowledgeGraph
  initialFocus?: string | null
}) {
  const [selected, setSelected] = useState<string | null>(initialFocus ?? null)
  const isNarrow = useIsNarrow()
  const reducedMotion = useReducedMotion()

  const select = useCallback((ref: string | null) => {
    setSelected(ref)
    // Keep the URL linkable without re-rendering the server tree.
    const url = new URL(window.location.href)
    if (ref) url.searchParams.set('focus', ref)
    else url.searchParams.delete('focus')
    window.history.replaceState(null, '', url.toString())
  }, [])

  // Escape clears the selection everywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') select(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [select])

  if (isNarrow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <KnowledgeBrowse nodes={graph.nodes} onOpen={select} />
        <AnimatePresence>
          {selected && (
            <motion.div
              key="kn-sheet"
              className="kn-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => select(null)}
            >
              <motion.div
                className="kn-sheet"
                role="dialog"
                aria-modal="true"
                initial={reducedMotion ? { opacity: 0 } : { y: '8%', opacity: 0 }}
                animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { y: '8%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <button type="button" className="kn-icon-btn" aria-label="Close" onClick={() => select(null)}>
                    <X size={16} />
                  </button>
                </div>
                <KnowledgePanel nodeRef={selected} stats={graph.stats} onSelect={select} onClose={() => select(null)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="graph-explorer">
      <GraphCanvas
        nodes={graph.nodes}
        links={graph.links}
        selectedId={selected}
        onSelect={select}
        initialFocus={initialFocus}
      />
      <aside className="graph-sidebar">
        <KnowledgePanel nodeRef={selected} stats={graph.stats} onSelect={select} onClose={() => select(null)} />
      </aside>
    </div>
  )
}
