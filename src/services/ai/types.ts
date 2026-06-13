/**
 * Provider-agnostic AI contracts.
 *
 * Business logic (analysis, search, alerts, digest) depends ONLY on these
 * interfaces + the high-level functions in `./index.ts` — never on a concrete
 * vendor SDK. Swapping in a paid provider later (OpenAI, Anthropic, …) means
 * adding one file that implements these interfaces and flipping AI_PROVIDER.
 */

/** Minimal JSON-schema subset understood by structured-output providers. */
export interface AiJsonSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  enum?: string[]
  format?: string
  items?: AiJsonSchema
  properties?: Record<string, AiJsonSchema>
  required?: string[]
}

export interface GenerateJsonRequest {
  prompt: string
  schema: AiJsonSchema
  /** Soft cap for the response; providers may ignore it. */
  maxOutputTokens?: number
}

export type AiErrorKind = 'rate_limit' | 'auth' | 'unavailable' | 'bad_response'

export class AiProviderError extends Error {
  readonly kind: AiErrorKind
  /** true → worth retrying later (quota/transient); false → fall back now. */
  readonly retryable: boolean

  constructor(message: string, kind: AiErrorKind) {
    super(message)
    this.name = 'AiProviderError'
    this.kind = kind
    this.retryable = kind === 'rate_limit' || kind === 'unavailable'
  }
}

/** Structured text generation (analysis, query understanding). */
export interface AiTextProvider {
  readonly name: string
  generateJson<T = unknown>(req: GenerateJsonRequest): Promise<T>
}

export type EmbedTaskType = 'document' | 'query'

/** Text embeddings for semantic search. */
export interface AiEmbeddingProvider {
  readonly name: string
  readonly embeddingModel: string
  readonly embeddingDims: number
  /** Returns one L2-normalized vector per input text, in order. */
  embed(texts: string[], taskType: EmbedTaskType): Promise<number[][]>
}
