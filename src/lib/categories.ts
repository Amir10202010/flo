import type { EmailCategory } from '@/types'

/**
 * Email-category metadata + small pure helpers shared by the classifier,
 * the API layer and the inbox UI. No I/O — safe to import anywhere
 * (server components, client components, the classifier test harness).
 */

export const EMAIL_CATEGORIES: EmailCategory[] = [
  'PRIMARY',
  'CLIENTS',
  'SERVICES',
  'PROMOTIONS',
  'NEWSLETTERS',
  'SPAM',
]

const CATEGORY_SET = new Set<string>(EMAIL_CATEGORIES)

export function isEmailCategory(v: unknown): v is EmailCategory {
  return typeof v === 'string' && CATEGORY_SET.has(v)
}

export interface CategoryMeta {
  key: EmailCategory
  label: string
  /** One-liner shown in the move menu / tooltip. */
  description: string
  /** Accent colour used for chips/dots. */
  color: string
}

export const CATEGORY_META: Record<EmailCategory, CategoryMeta> = {
  PRIMARY: {
    key: 'PRIMARY',
    label: 'Primary',
    description: 'Important personal & direct mail that doesn’t fit another bucket.',
    color: '#4F5CF4',
  },
  CLIENTS: {
    key: 'CLIENTS',
    label: 'Clients',
    description: 'Real two-way conversations with customers and prospects.',
    color: '#0EA472',
  },
  SERVICES: {
    key: 'SERVICES',
    label: 'Services',
    description: 'Invoices, payments, receipts and transactional service mail.',
    color: '#7C3AED',
  },
  PROMOTIONS: {
    key: 'PROMOTIONS',
    label: 'Promotions',
    description: 'Marketing, sales, deals and offers.',
    color: '#D97706',
  },
  NEWSLETTERS: {
    key: 'NEWSLETTERS',
    label: 'Newsletters',
    description: 'Subscriptions, digests and bulk updates.',
    color: '#0891B2',
  },
  SPAM: {
    key: 'SPAM',
    label: 'Spam',
    description: 'Junk and unwanted mail — kept out of your other categories.',
    color: '#DC2626',
  },
}

/** Lower-cased domain part of an email address, or '' when unparseable. */
export function domainOf(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.lastIndexOf('@')
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : ''
}

/** Local part (before @) of an email address, lower-cased. */
export function localPartOf(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.indexOf('@')
  return (at >= 0 ? email.slice(0, at) : email).trim().toLowerCase()
}

/**
 * Free webmail domains: a domain rule on these would mis-bucket unrelated
 * senders, so we never auto-learn domain rules for them (email-level only).
 */
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'mail.ru',
  'yandex.ru',
  'yandex.com',
  'gmx.com',
  'zoho.com',
])

/** Local parts that signal automated / no-reply / bulk senders (not a human). */
const BULK_LOCALPARTS = new Set([
  'noreply',
  'no-reply',
  'no_reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'notification',
  'notify',
  'mailer',
  'mailer-daemon',
  'bounce',
  'bounces',
  'newsletter',
  'newsletters',
  'news',
  'updates',
  'update',
  'info',
  'hello',
  'team',
  'support',
  'alerts',
  'alert',
  'digest',
])

export function isBulkLocalPart(localPart: string): boolean {
  if (!localPart) return false
  if (BULK_LOCALPARTS.has(localPart)) return true
  // noreply+anything, no-reply.something, etc.
  return /^(no-?reply|do-?not-?reply|donotreply|mailer|bounce|notif)/.test(localPart)
}
