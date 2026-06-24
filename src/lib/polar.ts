/**
 * Server-only Polar SDK client, built from env. `POLAR_SERVER` selects the
 * sandbox vs production API. Memoized so we don't reconstruct per request.
 */
import { Polar } from '@polar-sh/sdk'

let _polar: Polar | null = null

export function getPolar(): Polar {
  if (_polar) return _polar
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) throw new Error('POLAR_ACCESS_TOKEN is not set')
  const server = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
  _polar = new Polar({ accessToken, server })
  return _polar
}
