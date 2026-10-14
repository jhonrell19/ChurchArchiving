import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const SESSION_COOKIE = 'parish_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getRoleHome(role: Role) {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'BURIAL_ADMIN':
      return '/burial-admin'
    default:
      return '/dashboard'
  }
}

export function isUserProfileComplete(user: {
  firstName: string | null
  surname: string | null
  phoneNumber: string | null
  address: string | null
}) {
  return Boolean(
    user.firstName?.trim() &&
      user.surname?.trim() &&
      user.phoneNumber?.trim() &&
      user.address?.trim()
  )
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  )

  // Keep one active browser session per account. A new login
  // invalidates the previous session for predictable account security.
  await prisma.session.deleteMany({ where: { userId } })

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  })

  return { token, expiresAt }
}

export async function destroySessionToken(
  token: string | undefined
) {
  if (!token) return

  const tokenHash = hashSessionToken(token)
  await prisma.session.deleteMany({ where: { tokenHash } })
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) return null

  const tokenHash = hashSessionToken(token)

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          surname: true,
          phoneNumber: true,
          address: true,
          email: true,
          role: true,
          emailVerified: true,
          googleSub: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined)
    return null
  }

  return session.user
}

export async function requireRole(requiredRole: Role) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== requiredRole) {
    redirect(getRoleHome(user.role))
  }

  return user
}
