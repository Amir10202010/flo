import crypto from 'crypto'

/**
 * Symmetric encryption for secrets at rest (OAuth access/refresh tokens).
 *
 * Stored format:  enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * The key is derived (SHA-256) from TOKEN_ENCRYPTION_KEY so any-length secret
 * works. If the env var is missing we fall back to storing plaintext and warn —
 * this keeps local dev working, but production MUST set TOKEN_ENCRYPTION_KEY.
 *
 * decryptSecret() transparently returns legacy plaintext values (those without
 * the `enc:` prefix) unchanged, so existing rows keep working until re-written.
 */

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'

function getKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) return null
  return crypto.createHash('sha256').update(secret).digest()
}

let warned = false
function warnOnce() {
  if (!warned) {
    warned = true
    console.warn(
      '[crypto] TOKEN_ENCRYPTION_KEY is not set — OAuth tokens are stored in PLAINTEXT. Set it before production.',
    )
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  if (!key) {
    warnOnce()
    return plaintext
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value // legacy plaintext
  const key = getKey()
  if (!key) {
    throw new Error('[crypto] Encrypted token found but TOKEN_ENCRYPTION_KEY is not set')
  }
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
