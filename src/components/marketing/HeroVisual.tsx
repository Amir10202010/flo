'use client'

/**
 * HeroVisual — the hero centerpiece.
 *
 * Not a 3D model: a real product mockup (the Velnox inbox) that tilts in 3D
 * toward the pointer with spring physics and a perspective parent, sitting over
 * a soft radial bloom. The floating glass metric cards (in page.tsx) parallax
 * around it, so the whole stage reads as layered depth — a "cool 3D transition"
 * built from real UI, no WebGL.
 *
 * Reduced motion → no tilt (static). Touch / no-pointer → static, still polished.
 */

import { useReducedMotion, useMotionValue, useSpring, useTransform, motion } from 'framer-motion'
import HeroMockup from './HeroMockup'

export default function HeroVisual() {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 150, damping: 18, mass: 0.4 })
  const sy = useSpring(py, { stiffness: 150, damping: 18, mass: 0.4 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-15, 15])
  const rotateX = useTransform(sy, [-0.5, 0.5], [11, -11])

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const reset = () => { px.set(0); py.set(0) }

  return (
    <div
      className="hero-canvas-wrap"
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ perspective: 1200 }}
    >
      <div className="core-bloom" aria-hidden />
      <motion.div className="hero-tilt" style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
        <HeroMockup />
      </motion.div>
    </div>
  )
}
