/**
 * Onboarding tour steps. Single source of truth for the spotlight tour copy and
 * order. `target` is the `data-tour` attribute of the element to highlight in the
 * sidebar; `null` renders a centered bubble with no spotlight cutout (the welcome
 * step, and the fallback whenever a target can't be found — e.g. narrow viewport).
 *
 * Bump TOUR_STORAGE_KEY's version suffix when the tour is revamped so it
 * re-shows for everyone who already saw the previous one.
 */
export const TOUR_STORAGE_KEY = 'velnox:onboarding:v1'

export interface TourStep {
  /** `data-tour` value of the element to spotlight, or null for a centered card. */
  target: string | null
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to Velnox',
    body: "A 30-second tour — here's where everything lives.",
  },
  {
    target: 'inbox',
    title: 'Inbox',
    body: 'Every email, AI-prioritized, with reply drafts and Smart Compose.',
  },
  {
    target: 'clients',
    title: 'Clients',
    body: "One card per contact: engagement, risk, and who's awaiting a reply.",
  },
  {
    target: 'insights',
    title: 'Insights',
    body: 'A feed of AI observations and suggested next steps.',
  },
  {
    target: 'risk',
    title: 'Risk Monitor',
    body: 'Clients at risk: overdue replies, negative sentiment, gone quiet.',
  },
  {
    target: 'analytics',
    title: 'Analytics',
    body: 'Response-time, volume, and distribution trends at a glance.',
  },
  {
    target: 'assistant',
    title: 'AI Assistant',
    body: 'Your beta workspace copilot — ask questions about your inbox.',
  },
  {
    target: 'search',
    title: 'Search anything',
    body: 'Press ⌘K / Ctrl+K to jump anywhere and AI-search your mail.',
  },
]
