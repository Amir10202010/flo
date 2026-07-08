import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://velnox.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep the authenticated product surface out of the index.
        disallow: ['/api/', '/dashboard', '/inbox', '/clients', '/settings', '/onboarding', '/assistant', '/o/', '/workspace'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
