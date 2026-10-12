import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000

export function hashAccountToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function newToken() {
  return randomBytes(32).toString('base64url')
}

export async function createEmailVerificationToken(userId: number) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } })
  const token = newToken()
  await prisma.emailVerificationToken.create({
    data: {
      tokenHash: hashAccountToken(token),
      userId,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    },
  })
  return token
}

export async function createPasswordResetToken(userId: number) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } })
  const token = newToken()
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashAccountToken(token),
      userId,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  })
  return token
}
