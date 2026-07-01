/**
 * Workspace terminology — how this business names CRM-generic concepts
 * ("contact" → Patient, "conversation" → Inquiry). The map lives on
 * WorkspaceProfile.terminology; UI and server copy resolve through
 * `resolveTerm` so every surface degrades to sensible defaults.
 */

export interface Term {
  singular: string
  plural: string
}

export type TerminologyMap = Record<string, Term>

/** CRM-generic defaults used when a workspace has no override for a term. */
export const DEFAULT_TERMS: TerminologyMap = {
  contact: { singular: 'Client', plural: 'Clients' },
  conversation: { singular: 'Conversation', plural: 'Conversations' },
}

/** Override → default → identity ("foo" → Foo/Foos never throws). */
export function resolveTerm(map: TerminologyMap | null | undefined, key: string): Term {
  const override = map?.[key]
  if (override?.singular && override?.plural) return override
  const fallback = DEFAULT_TERMS[key]
  if (fallback) return fallback
  const title = key.charAt(0).toUpperCase() + key.slice(1)
  return { singular: title, plural: `${title}s` }
}
