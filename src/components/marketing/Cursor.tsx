'use client'

import { motion } from 'framer-motion'

/** Animated macOS-style pointer used by the scripted product demos.
 *  Position is controlled by the parent via `x`/`y` (pixels, relative to the
 *  scene container). `clicking` triggers a quick press + ripple. */
export default function Cursor({ x, y, visible, clicking }: { x: number; y: number; visible: boolean; clicking?: boolean }) {
  return (
    <motion.div
      className="demo-cursor"
      initial={false}
      animate={{ x, y, opacity: visible ? 1 : 0, scale: clicking ? 0.82 : 1 }}
      transition={{
        x: { type: 'spring', stiffness: 120, damping: 18, mass: 0.7 },
        y: { type: 'spring', stiffness: 120, damping: 18, mass: 0.7 },
        scale: { duration: 0.18 },
        opacity: { duration: 0.3 },
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M4 2.5L17 11L10.5 12.2L14 18.5L11.3 19.8L7.8 13.4L4 17V2.5Z"
          fill="#0C0E1D"
          stroke="#FFFFFF"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {clicking && (
        <motion.span
          initial={{ scale: 0, opacity: 0.55 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: 2, left: 2, width: 20, height: 20,
            borderRadius: '50%', background: 'rgba(79,92,244,0.35)',
          }}
        />
      )}
    </motion.div>
  )
}
