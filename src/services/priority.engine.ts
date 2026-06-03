import type { PriorityScoreResult } from '@/types'

export function calculatePriority(messages: any[], analysis: any, lastMessageAt: Date | null): PriorityScoreResult {
  let score = 0
  const reasons: string[] = []

  if (!messages.length || !lastMessageAt) return { level: 'COLD', score: 0, reasons: ['No messages'] }

  const last = messages[messages.length - 1]
  const lastIsInbound = last?.direction === 'INBOUND'
  const hoursSince = (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60)

  if (lastIsInbound) { score += 40; reasons.push('Client awaiting reply') }
  if (hoursSince < 1) { score += 30 }
  else if (hoursSince < 4) { score += 20 }
  else if (hoursSince < 24) { score += 10 }
  else if (hoursSince > 48 && lastIsInbound) { score -= 10; reasons.push('Reply overdue >48h') }

  if (analysis?.riskLevel === 'CRITICAL') { score += 30; reasons.push('Critical risk') }
  else if (analysis?.riskLevel === 'HIGH') { score += 20 }
  else if (analysis?.riskLevel === 'MEDIUM') { score += 10 }

  const level: PriorityScoreResult['level'] = score >= 70 ? 'HOT' : score >= 40 ? 'ATTENTION' : score >= 10 ? 'COLD' : 'SPAM'
  return { level, score: Math.min(100, Math.max(0, score)), reasons }
}
