'use client'

import { Compass } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'

/** Settings-page button that re-runs the onboarding spotlight tour. */
export default function ReplayTourButton() {
  const startTour = useUiStore((s) => s.startTour)
  return (
    <button type="button" className="btn-ghost" onClick={startTour} style={{ fontSize: 13, padding: '8px 14px' }}>
      <Compass size={14} />
      Replay product tour
    </button>
  )
}
