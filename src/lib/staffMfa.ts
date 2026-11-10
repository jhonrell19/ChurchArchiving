import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { prisma } from '@/lib/prisma'

export const MFA_PENDING_COOKIE = 'parish_mfa_pending'
export const MFA_PENDING_MAX_AGE = 10 * 60
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function mfaKeyConfigured() {
  try { encryptionKey(); return true } catch { return false }
}

function encryptionKey() {
  const raw = process.env.STAFF_MFA_ENCRYPTION_KEY?.trim() || ''
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('STAFF_MFA_ENCRYPTION_KEY must be a random 32-byte key (base64 or hex).')
  return key
}

export function encryptMfaSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.')
}

export function decryptMfaSecret(value: string) {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted staff MFA secret.')
  const [iv, body, tag] = parts.map(p => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

export function base32Encode(input: Buffer) {
  let bits = 0; let current = 0; let result = ''
  for (const b of input) {
    current = (current << 8) | b; bits += 8
    while (bits >= 5) { result += ALPHABET[(current >>> (bits -= 5)) & 31] }
  }
  if (bits > 0) result += ALPHABET[(current << (5 - bits)) & 31]
  return result
}

function base32Decode(input: string) {
  let bits = 0; let current = 0; const output: number[] = []
  for (const c of input.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(c)
    if (v < 0) throw new Error('Invalid authenticator secret.')
    current = (current << 5) | v; bits += 5
    if (bits >= 8) { output.push((current >>> (bits -= 8)) & 255); current &= (1 << bits) - 1 }
  }
  return Buffer.from(output)
}

export function generateTotpSecret() { return base32Encode(randomBytes(20)) }

export function totpAt(secret: string, counter: number) {
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', base32Decode(secret)).update(bytes).digest()
  const offset = digest[digest.length - 1] & 15
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

/** Return the matching 30-second time counter, or null. Prevent replay using lastUsedStep. */
export function matchingTotpStep(secret: string, code: string, lastUsedStep = -1, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null
  const current = Math.floor(timestamp / 30_000)
  for (let delta = -1; delta <= 1; delta++) {
    const step = current + delta
    if (step <= lastUsedStep) continue
    if (timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))) return step
  }
  return null
}

export function hashMfaRecoveryCode(code: string) {
  return createHash('sha256').update(code.toUpperCase().replace(/[^0-9A-Z]/g, '')).digest('hex')
}

export function createRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(12).toString('hex').toUpperCase())
}

export function isRecoveryCode(input: string) { return /^[A-Fa-f\d]{24}$/.test(input.replace(/[\s-]/g, '')) }
export function normalizeRecoveryCode(input: string) { return input.replace(/[\s-]/g, '').toUpperCase() }

function challengeHash(token: string) { return createHash('sha256').update(token).digest('hex') }

export async function issueStaffMfaChallenge(userId: number) {
  const token = randomBytes(32).toString('base64url')
  await prisma.staffMfaChallenge.deleteMany({ where: { userId } })
  await prisma.staffMfaChallenge.create({ data: { userId, tokenHash: challengeHash(token), expiresAt: new Date(Date.now() + MFA_PENDING_MAX_AGE * 1000) } })
  return token
}

export async function findValidStaffChallenge(token: string | undefined) {
  if (!token) return null
  const challenge = await prisma.staffMfaChallenge.findUnique({
    where: { tokenHash: challengeHash(token) },
    include: { user: { select: { id: true, email: true, role: true, emailVerified: true } } },
  })
  if (!challenge || challenge.expiresAt.getTime() < Date.now() || challenge.attempts >= 5 || challenge.user.role === 'USER' || !challenge.user.emailVerified) return null
  return challenge
}
