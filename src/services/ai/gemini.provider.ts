import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Schema } from '@google/generative-ai'
import {
  AiProviderError,
  type AiEmbeddingProvider,
  type AiTextProvider,
  type EmbedTaskType,
  type GenerateJsonRequest,
} from './types'

/**
 * Gemini provider — the FREE default. A Google AI Studio key has a no-billing
 * free tier for both generation (gemini-2.0-flash) and embeddings
 * (gemini-embedding-001), which is what keeps the whole AI stack $0 today.
 *
 * Models are overridable via GEMINI_MODEL / AI_EMBEDDING_MODEL without code
 * changes. 429s map to retryable AiProviderError so the job queue's
 * exponential backoff (queue.failJob) does the rate-limit pacing for us.
 */

// NOTE: the Gemini 2.0 models lost their free tier (quota limit 0 as of 2026);
// 2.5-flash / 2.5-flash-lite are the free-tier generation models now.
const GENERATION_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001'
const EMBEDDING_DIMS = 768
const EMBED_BATCH = 16

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new AiProviderError('GEMINI_API_KEY is not set', 'auth')
  return key
}

function classify(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err
  const msg = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status
  if (status === 429 || /429|quota|rate.?limit|resource.?exhausted/i.test(msg)) {
    return new AiProviderError(`Gemini rate-limited: ${msg}`, 'rate_limit')
  }
  if (status === 401 || status === 403 || /api.?key|permission/i.test(msg)) {
    return new AiProviderError(`Gemini auth failed: ${msg}`, 'auth')
  }
  if ((status !== undefined && status >= 500) || /fetch failed|network|ECONNRESET|ETIMEDOUT|503|500/i.test(msg)) {
    return new AiProviderError(`Gemini unavailable: ${msg}`, 'unavailable')
  }
  return new AiProviderError(`Gemini error: ${msg}`, 'bad_response')
}

function l2Normalize(v: number[]): number[] {
  let norm = 0
  for (const x of v) norm += x * x
  norm = Math.sqrt(norm)
  if (!Number.isFinite(norm) || norm === 0) return v
  return v.map((x) => x / norm)
}

class GeminiProvider implements AiTextProvider, AiEmbeddingProvider {
  readonly name = 'gemini'
  readonly embeddingModel = EMBEDDING_MODEL
  readonly embeddingDims = EMBEDDING_DIMS

  async generateJson<T = unknown>(req: GenerateJsonRequest): Promise<T> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey())
      const model = genAI.getGenerativeModel({
        model: GENERATION_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          // Our AiJsonSchema subset is structurally a Gemini Schema (SchemaType
          // enum values are the lowercase JSON-schema type names).
          responseSchema: req.schema as unknown as Schema,
          ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
        },
      })

      const result = await model.generateContent(req.prompt)
      const text = result.response.text()
      try {
        return JSON.parse(text) as T
      } catch {
        throw new AiProviderError(
          `Gemini returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
          'bad_response',
        )
      }
    } catch (err) {
      throw classify(err)
    }
  }

  /**
   * Embeddings via the REST batch endpoint (the SDK pinned in package.json
   * predates outputDimensionality support). Vectors are L2-normalized here so
   * cosine similarity downstream is a plain dot product.
   */
  async embed(texts: string[], taskType: EmbedTaskType): Promise<number[][]> {
    if (!texts.length) return []
    const key = apiKey()
    const gTask = taskType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'
    const out: number[][] = []

    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${EMBEDDING_MODEL}`,
              content: { parts: [{ text }] },
              taskType: gTask,
              outputDimensionality: EMBEDDING_DIMS,
            })),
          }),
        },
      ).catch((e) => {
        throw new AiProviderError(`Gemini embeddings fetch failed: ${e}`, 'unavailable')
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const msg = `Gemini embeddings HTTP ${res.status}: ${body.slice(0, 200)}`
        if (res.status === 429) throw new AiProviderError(msg, 'rate_limit')
        if (res.status === 401 || res.status === 403) throw new AiProviderError(msg, 'auth')
        if (res.status >= 500) throw new AiProviderError(msg, 'unavailable')
        throw new AiProviderError(msg, 'bad_response')
      }

      const data = (await res.json()) as { embeddings?: { values?: number[] }[] }
      const vectors = data.embeddings ?? []
      if (vectors.length !== batch.length) {
        throw new AiProviderError(
          `Gemini embeddings: expected ${batch.length} vectors, got ${vectors.length}`,
          'bad_response',
        )
      }
      for (const v of vectors) {
        if (!Array.isArray(v.values) || !v.values.length) {
          throw new AiProviderError('Gemini embeddings: empty vector in response', 'bad_response')
        }
        out.push(l2Normalize(v.values))
      }
    }
    return out
  }
}

export const geminiProvider = new GeminiProvider()
