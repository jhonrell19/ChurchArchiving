import 'server-only'

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Database-backed authorization, NOT a decoded user cookie.
 *
 * Every protected request must verify that the token hash still exists, has
 * not expired and belongs to an enabled, verified user with the required role.
 * Revocation is immediate across browsers and Render instances.
 */
export const SESSION_COOKIE = 'parish_session'
export type ActiveSessionUser = NonNullable<Awaited<ReturnType<typeof validateSessionToken>>>

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function validateSessionToken(token: string | undefined | null) {
  // createSession issues 32 random bytes in base64url (43 characters).
  // A malformed or attacker-controlled cookie is never a valid session.
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true, firstName: true, middleName: true, surname: true,
          phoneNumber: true, address: true, email: true, role: true,
          membershipStatus: true, emailVerified: true, accountEnabled: true,
          googleSub: true, createdAt: true, updatedAt: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    // Fail closed even if background session cleanup cannot reach the database.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }

  if (!session.user.accountEnabled || !session.user.emailVerified) return null
  if (session.user.role === 'USER' && session.user.membershipStatus !== 'approved')
    return null

  return session.user
}
