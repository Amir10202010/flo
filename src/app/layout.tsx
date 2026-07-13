import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import PostHogProvider from '@/components/analytics/PostHogProvider'
import './globals.css'

// One typeface for the product (UI + marketing body): Inter, the calm, neutral,
// "invisible" sans used by Linear/GitHub/Stripe. Fraunces (soft bookish serif,
// the closest Google face to Cluely's display look) exists for a single job —
// the landing hero headline (.hero-serif) — and must not creep into UI surfaces.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

// Variable cut with the SOFT/WONK/opsz axes so .hero-serif can pin a LOW
// optical size — at display sizes the auto opsz turns Didone-sharp (reads
// like the old Instrument Serif); the low-opsz soft cut is the Cluely look.
const fraunces = Fraunces({
  variable: '--font-hero-serif',
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const TITLE = 'Velnox — Never lose a client in your Gmail'
const DESCRIPTION =
  'Velnox reads your Gmail and tells you which client to answer today, who’s going cold, and what to say — with the reply already drafted. Your own inbox, made smarter.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior suppresses Next.js router warning about smooth scroll
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full">
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
