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
      {!videoFailed && (
        <div className="scene" style={{ display: videoReady ? 'block' : 'none' }}>
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
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
      )}
      {!videoReady && <ProductDemo />}
    </div>
  )
}
