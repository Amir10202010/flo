import type { Metadata } from 'next'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Flo — AI inbox for sales managers',
  description:
    "Flo unifies Telegram and Gmail, shows you who to write to right now, and explains why you're losing clients.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior suppresses Next.js router warning about smooth scroll
    <html lang="en" data-scroll-behavior="smooth" className={`${dmSans.variable} ${instrumentSerif.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
