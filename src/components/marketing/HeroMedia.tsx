'use client'

import { useEffect, useRef, useState } from 'react'
import ProductDemo from './ProductDemo'

/**
 * The hero demo slot. Drop a product screencast at `public/demo.mp4` and it
 * plays here (muted, looping) inside the same window chrome. While the file is
 * missing or still buffering, the animated ProductDemo scene shows instead —
 * no layout jump, no broken-player flash.
 */
export default function HeroMedia() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  // Media errors (missing file) can fire before hydration, so React's onError
  // never sees them — re-check the element state once after mount.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (el.error) setVideoFailed(true)
    else if (el.readyState >= 3) setVideoReady(true)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      {/* Cluely-style cool ambience bleeding out from behind the window */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-13% -11% -17%',
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(62% 60% at 50% 44%, rgba(79,92,244,0.75), rgba(96,165,250,0.5) 50%, rgba(124,192,255,0) 76%)',
          filter: 'blur(38px)',
        }}
      />
      {!videoFailed && (
        <div className="scene" style={{ position: 'relative', zIndex: 1, display: videoReady ? 'block' : 'none' }}>
          {/* The capture has 96px of black pillarboxing burned into each side of
              its 1920px frame (5%) — overscan the video by 1920/1728 so the
              window chrome crops the bars away. */}
          <video
            ref={videoRef}
            src="/demo.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            style={{ display: 'block', width: '111.12%', maxWidth: 'none', marginLeft: '-5.56%', height: 'auto' }}
          />
        </div>
      )}
      {!videoReady && <div style={{ position: 'relative', zIndex: 1 }}><ProductDemo /></div>}
    </div>
  )
}
