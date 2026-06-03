export type PriorityLevel = 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'

export interface MessageItem {
  id: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  sentAt: string
}

export interface ConversationWithDetails {
  id: string
  channel: 'TELEGRAM' | 'GMAIL'
  contact: {
    name: string
    email?: string
    telegramId?: string
  }
  subject?: string
  status: 'ACTIVE' | 'ARCHIVED' | 'LOST'
  priority: PriorityLevel
  priorityScore: number
  lastMessageAt: Date | null
  messages: MessageItem[]
  analysis?: any
  unreadCount: number
}

export interface PriorityScoreResult {
  level: PriorityLevel
  score: number
  reasons: string[]
}

export interface AnalysisResult {
  summary: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskReasons: string[]
  nextAction: string
  lostReason?: string
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
}

export interface SyncResult {
  synced: number
  created: number
  updated: number
  errors: string[]
}

export interface GeminiAnalysisPayload {
  conversationId: string
  channel: string
  contactName: string
  messages: Array<{
    direction: 'INBOUND' | 'OUTBOUND'
    content: string
    sentAt: string
  }>
}
