// ── Core domain enums ──────────────────────────────────────────────────────

export type PriorityLevel = 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'
export type EmailCategory = 'PRIMARY' | 'CLIENTS' | 'SERVICES' | 'PROMOTIONS' | 'NEWSLETTERS' | 'SPAM'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type Channel = 'TELEGRAM' | 'GMAIL'
export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'LOST'
export type MessageDirection = 'INBOUND' | 'OUTBOUND'

// ── Service layer types ────────────────────────────────────────────────────

export interface MessageItem {
  id: string
  direction: MessageDirection
  content: string
  contentType: 'TEXT' | 'HTML' | 'ATTACHMENT'
  sentAt: string   // ISO-8601
  isRead: boolean
}

export interface ConversationAnalysisData {
  summary: string
  riskLevel: RiskLevel
  riskReasons: string[]
  nextAction: string | null
  lostReason: string | null
  sentiment: Sentiment
  updatedAt: string  // ISO-8601
}

export interface PriorityScoreResult {
  level: PriorityLevel
  score: number
  reasons: string[]
}

export interface AnalysisResult {
  summary: string
  riskLevel: RiskLevel
  riskReasons: string[]
  nextAction: string
  lostReason?: string
  sentiment: Sentiment
  /** AI's email-category suggestion — used only to enrich low-confidence rule
   * classification (never overrides a confident rule or a manual move). */
  category?: EmailCategory
}

export interface GeminiAnalysisPayload {
  conversationId: string
  channel: string
  contactName: string
  messages: Array<{
    direction: MessageDirection
    content: string
    sentAt: string
  }>
}

export interface SyncResult {
  synced: number
  created: number
  updated: number
  errors: string[]
  /** Conversation IDs that received new inbound messages — candidates for AI analysis. */
  changedConversationIds?: string[]
}

// ── Background job queue ────────────────────────────────────────────────────

export type JobStatusValue = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type JobTypeValue =
  | 'GMAIL_SYNC'
  | 'ANALYZE_CONVERSATION'
  | 'EMBED_CONVERSATION'
  | 'SCAN_RISK_ALERTS'
  | 'SEND_WEEKLY_DIGEST'

/** Shape returned by GET /api/jobs/[id]. */
export interface JobStatusResponse {
  id: string
  type: JobTypeValue
  status: JobStatusValue
  result: unknown | null
  error: string | null
  finishedAt: string | null
}

// ── API response types (used by /api/conversations routes) ─────────────────

/** Lightweight shape returned by GET /api/conversations (list). */
export interface ConversationListItem {
  id: string
  channel: Channel
  subject: string | null
  status: ConversationStatus
  priority: PriorityLevel
  priorityScore: number
  category: EmailCategory
  lastMessageAt: string | null   // ISO-8601
  contact: {
    name: string
    email: string | null
  }
  lastMessage: string | null
  unreadCount: number
}

/** Full shape returned by GET /api/conversations/[id] (detail). */
export interface ConversationDetail {
  id: string
  channel: Channel
  subject: string | null
  status: ConversationStatus
  priority: PriorityLevel
  priorityScore: number
  category: EmailCategory
  lastMessageAt: string | null   // ISO-8601
  lastAnalyzedAt: string | null  // ISO-8601
  contact: {
    name: string
    email: string | null
    telegramId: string | null
  }
  messages: MessageItem[]
  analysis: ConversationAnalysisData | null
}

/** Shape returned by POST /api/conversations/[id]/analyze. */
export interface AnalyzeResponse {
  analysis: AnalysisResult
  priority: PriorityScoreResult
}

// ── AI search (GET /api/search) ─────────────────────────────────────────────

export interface SearchResultItem {
  id: string
  channel: Channel
  subject: string | null
  status: ConversationStatus
  priority: PriorityLevel
  priorityScore: number
  category: EmailCategory
  lastMessageAt: string | null   // ISO-8601
  contact: {
    name: string
    email: string | null
  }
  /** Matched-text window, AI summary, or last-message preview. */
  snippet: string | null
  /** Blended relevance 0–1 (keyword + semantic + recency/priority boosts). */
  score: number
  /** Which fields matched the query terms: contact / email / subject / summary / message. */
  matchedOn: string[]
  /** true when only the embedding (meaning, not literal text) matched. */
  semanticMatch: boolean
  awaitingReply: boolean
  risk: RiskLevel | null
}

export interface SearchResponse {
  items: SearchResultItem[]
  meta: {
    /** hybrid = keyword + semantic; keyword = no embeddings; filter = empty query. */
    mode: 'hybrid' | 'keyword' | 'filter'
    total: number
    tookMs: number
    /** Structured intent the AI extracted from the query, when available. */
    parsedFilters: {
      keywords: string[]
      priority?: PriorityLevel
      risk?: RiskLevel
      sentiment?: Sentiment
      awaitingReply?: boolean
      daysBack?: number
    } | null
    /** Non-fatal capability notes (e.g. embeddings-unavailable). */
    degraded: string[] | null
  }
}

// ── Risk alerts (GET /api/alerts) ───────────────────────────────────────────

export type AlertStatusValue = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface RiskAlertItem {
  id: string
  type: string
  severity: RiskLevel
  status: AlertStatusValue
  title: string
  reason: string
  suggestedAction: string | null
  conversationId: string | null
  href: string | null
  firstSeenAgo: string | null
  lastSeenAgo: string | null
}

// Legacy alias kept for inbox page compatibility
export type ConversationWithDetails = ConversationDetail
