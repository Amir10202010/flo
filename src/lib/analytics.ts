import posthog from 'posthog-js'

/**
 * Product-analytics event helper. No-ops entirely when PostHog isn't configured
 * (no `NEXT_PUBLIC_POSTHOG_KEY`) or on the server, so dev/build and the app
 * itself never depend on analytics being wired up.
 *
 * Only import this from client components — `posthog-js` is browser-only.
 */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    posthog.capture(event, props)
  } catch {
    // Swallow — analytics must never break a user flow.
  }
}
