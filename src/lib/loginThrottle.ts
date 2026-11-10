import { createHash } from 'node:crypto'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 6
// Defense-in-depth for one Node.js process. Production must ALSO rate-limit
// at the trusted reverse proxy, since this map is neither shared nor durable.
const attempts = new Map<string, { count: number; until: number }>()

const keyOf = (email: string) => createHash('sha256').update(email).digest('hex')

export function loginAllowed(email: string) {
  const key = keyOf(email)
  const entry = attempts.get(key)
  if (!entry) return true
  if (entry.until <= Date.now()) { attempts.delete(key); return true }
  return entry.count < MAX_FAILURES
}

export function loginFailed(email: string) {
  const key = keyOf(email)
  const entry = attempts.get(key)
  if (!entry || entry.until <= Date.now()) attempts.set(key, { count: 1, until: Date.now() + WINDOW_MS })
  else entry.count++
  if (attempts.size > 10000) {
    for (const [k, v] of attempts) if (v.until <= Date.now()) attempts.delete(k)
  }
}

export function loginSucceeded(email: string) { attempts.delete(keyOf(email)) }
