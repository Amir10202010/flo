import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://velnox.com'

// Public marketing routes only — the app surface is disallowed in robots.ts.
const ROUTES = ['', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${BASE}${path || '/'}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))
}
