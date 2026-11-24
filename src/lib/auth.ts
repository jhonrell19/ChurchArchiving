import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hashSessionToken, SESSION_COOKIE, validateSessionToken } from '@/lib/sessionValidation'

export { SESSION_COOKIE } from '@/lib/sessionValidation'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

export function getRoleHome(role: Role) {
  switch (role) {
    case 'ADMIN': return '/admin'
    case 'STAFF':
    case 'BURIAL_ADMIN': return '/staff'
    default: return '/dashboard'
  }
}

export function isUserProfileComplete(user: {
  firstName: string | null
  surname: string | null
}) {
  return Boolean(user.firstName?.trim() && user.surname?.trim())
}

export async function createSession(userId: number, staff = false) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(
    Date.now() + (staff ? STAFF_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS) * 1000
  )

  // Atomic rotation: a subsequent login invalidates old browser sessions.
  await prisma.$transaction(async tx => {
    await tx.session.deleteMany({ where: { userId } })
    await tx.session.create({ data: { tokenHash, userId, expiresAt } })
  })

  return { token, expiresAt }
}

export async function destroySessionToken(token: string | undefined) {
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
}

/** Server-only: never trust a user/role stored in localStorage or client state. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return validateSessionToken(token)
}

export async function requireRole(requiredRole: Role) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== requiredRole) redirect(getRoleHome(user.role))
  return user
}
