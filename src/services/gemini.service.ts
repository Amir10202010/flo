import type { AnalysisResult, GeminiAnalysisPayload } from '@/types'

export async function analyzeConversation(payload: GeminiAnalysisPayload): Promise<AnalysisResult> {
  // Placeholder: real implementation requires GEMINI_API_KEY
  return {
    summary: 'No analysis (local placeholder).',
    riskLevel: 'LOW',
    riskReasons: [],
    nextAction: 'Review conversation',
    lostReason: undefined,
    sentiment: 'NEUTRAL',
  }
}
