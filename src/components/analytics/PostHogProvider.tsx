'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// Module-scoped guard so React StrictMode's double-invoke (and client-side
// navigations that remount the tree) never re-initialize PostHog.
let started = false

/**
 * Initializes PostHog once, on the client, only when a key is configured.
 * With no `NEXT_PUBLIC_POSTHOG_KEY` this renders its children untouched and
 * loads nothing — analytics is strictly opt-in via env.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (started) return
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    started = true
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    })
  }, [])

  return <>{children}</>
}
