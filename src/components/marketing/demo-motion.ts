import type { Transition, Variants } from 'framer-motion'

/* Shared motion language for every marketing demo scene, so all of them feel
 * like the same product: one set of springs, one easing, one entrance grammar. */

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const SPRING = {
  /** Slow cinematic glide — camera moves, large surface shifts. */
  camera: { type: 'spring', stiffness: 80, damping: 20, mass: 1.1 } satisfies Transition,
  /** Chat bubbles and cards entering the viewport. */
  pop: { type: 'spring', stiffness: 320, damping: 26, mass: 0.8 } satisfies Transition,
  /** Panels sliding in (composer, sheets, dialogs). */
  panel: { type: 'spring', stiffness: 230, damping: 26 } satisfies Transition,
  /** Tiny UI feedback — badges, toggles, checkmarks. */
  snap: { type: 'spring', stiffness: 480, damping: 26 } satisfies Transition,
}

/** Chat-bubble entrance: rises, settles and sharpens like a real message. */
export const bubbleIn = {
  initial: { opacity: 0, y: 16, scale: 0.94, filter: 'blur(3px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
}

/** Staggered build-in for the inner blocks of a demo scene. */
export const sceneStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
}

export const sceneItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
}

/** Line-by-line reveal inside AI panels (header → insight → action). */
export const lineStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.04 } },
}

export const lineIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
}
