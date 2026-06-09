// ── Core domain enums ──────────────────────────────────────────────────────

export type PriorityLevel = 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'
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
export type JobTypeValue = 'GMAIL_SYNC' | 'ANALYZE_CONVERSATION'

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

// Legacy alias kept for inbox page compatibility
export type ConversationWithDetails = ConversationDetail
