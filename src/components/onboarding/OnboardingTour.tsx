'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { TOUR_STEPS, TOUR_STORAGE_KEY } from './tour-steps'

/** Below this width the sidebar collapses; auto-start is suppressed (manual
 *  replay still works and falls back to centered bubbles). */
const MIN_AUTO_WIDTH = 900
const BUBBLE_WIDTH = 344
/** Breathing room around the spotlit element. */
const PAD = 6

type Rect = { top: number; left: number; width: number; height: number }

function readSeen(): boolean {
  try {
    return Boolean(localStorage.getItem(TOUR_STORAGE_KEY))
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, String(Date.now()))
  } catch {
    /* private mode / storage disabled — tour just re-shows next time */
  }
}

/**
 * First-run spotlight tour over the sidebar. Auto-starts once per browser on the
 * first `/dashboard` visit (wide viewports only); replayable from Settings and
 * the ⌘K palette via `startTour()`. Dependency-free: the dimming is a single
 * box-shadow "hole" over the target's bounding rect, the bubble is positioned
 * beside it. Stays on the current route — it never navigates.
 */
export default function OnboardingTour() {
  const reduced = useReducedMotion()
  const pathname = usePathname()
  const tourOpen = useUiStore((s) => s.tourOpen)
  const setTourOpen = useUiStore((s) => s.setTourOpen)
  const startTour = useUiStore((s) => s.startTour)

  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const autoChecked = useRef(false)

  // Auto-start once: first /dashboard visit, not yet seen, wide enough viewport.
  useEffect(() => {
    if (autoChecked.current) return
    autoChecked.current = true
    if (pathname !== '/dashboard') return
    if (readSeen()) return
    if (window.innerWidth < MIN_AUTO_WIDTH) return
    startTour()
  }, [pathname, startTour])

  const current = TOUR_STEPS[step]

  // Locate + measure the target element for the active step.
  const measure = useCallback(() => {
    const target = current?.target
    if (!target) {
      setRect(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'nearest' })
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [current])

  // Re-measure on step change (via the `measure` identity) and keep the
  // spotlight aligned on resize/scroll. setState happens inside the rAF/listener
  // callbacks (not synchronously in the effect body) so there's no cascade.
  useEffect(() => {
    if (!tourOpen) return
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [tourOpen, measure])

  const finish = useCallback(() => {
    markSeen()
    setTourOpen(false)
    setStep(0) // so a later replay starts from the welcome step
  }, [setTourOpen])

  const next = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) finish()
    else setStep((s) => s + 1)
  }, [step, finish])

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])

  // Keyboard: Esc skips, ←/→ navigate.
  useEffect(() => {
    if (!tourOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tourOpen, finish, next, back])

  if (!tourOpen || !current) return null

  const isFirst = step === 0
  const isLast = step === TOUR_STEPS.length - 1

  // The bubble sits to the right of the spotlit element when there's room,
  // otherwise (welcome step, missing target, very narrow screen) it centers.
  // Positioning lives on this wrapper so it never fights framer-motion's
  // transform (which would otherwise clobber a `translate(-50%,-50%)` centering).
  const hasSpot = Boolean(rect)
  const canPlaceRight = rect && rect.left + rect.width + BUBBLE_WIDTH + 28 < window.innerWidth
  const wrapperStyle: React.CSSProperties = canPlaceRight
    ? {
        position: 'fixed',
        left: rect!.left + rect!.width + 16,
        top: Math.max(12, Math.min(rect!.top - 6, window.innerHeight - 280)),
        zIndex: 1002,
      }
    : {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1002,
      }

  return (
    <AnimatePresence>
      <div key="tour" role="dialog" aria-modal="true" aria-label="Product tour" style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        {/* Click-catcher — swallows clicks so the highlighted nav can't fire by
            accident. For centered steps it also provides the dimming. */}
        <div
          onClick={finish}
          style={{
            position: 'absolute',
            inset: 0,
            background: hasSpot ? 'transparent' : 'rgba(10, 15, 40, 0.55)',
            cursor: 'default',
          }}
        />

        {/* Spotlight cutout: a transparent box whose huge box-shadow dims
            everything around the target. pointer-events:none so it never blocks. */}
        {rect && (
          <div
            style={{
              position: 'fixed',
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              borderRadius: 10,
              boxShadow: '0 0 0 9999px rgba(10, 15, 40, 0.55)',
              border: '2px solid var(--accent)',
              pointerEvents: 'none',
              transition: reduced ? undefined : 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
            }}
          />
        )}

        {/* Bubble (positioning on the wrapper, animation on the inner card) */}
        <div style={wrapperStyle}>
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: BUBBLE_WIDTH,
              maxWidth: 'calc(100vw - 24px)',
              pointerEvents: 'auto',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '4px 11px', borderRadius: 100 }}>
                <Sparkles size={13} />
                {step + 1} of {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={finish}
                aria-label="Skip tour"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={17} />
              </button>
            </div>

            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              {current.title}
            </h3>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{current.body}</p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={finish}
                style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '7px 2px' }}
              >
                Skip
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {!isFirst && (
                  <button type="button" className="btn-ghost" onClick={back} style={{ fontSize: 13.5, padding: '8px 14px' }}>
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                <button type="button" className="btn-primary" onClick={next} style={{ fontSize: 13.5, padding: '8px 16px' }}>
                  {isLast ? (
                    <>
                      <Check size={14} />
                      Done
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}
