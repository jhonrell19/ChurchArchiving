import { NextRequest, NextResponse } from 'next/server'
import { destroySessionToken, SESSION_COOKIE } from '@/lib/auth'
import { MFA_PENDING_COOKIE, findValidStaffChallenge } from '@/lib/staffMfa'
import { prisma } from '@/lib/prisma'
import { PRIVATE_CACHE_HEADERS } from '@/lib/routeAccess'

/**
 * Logout is POST-only, with the origin check enforced by src/proxy.ts.
 * Delete the hashed session in PostgreSQL before reporting success, and
 * redirect with 303 so the browser never replays a logout POST on history.
 */
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value
  const pendingToken = request.cookies.get(MFA_PENDING_COOKIE)?.value

  try {
    await destroySessionToken(sessionToken)
    const challenge = await findValidStaffChallenge(pendingToken)
    if (challenge) {
      await prisma.staffMfaChallenge.deleteMany({ where: { id: challenge.id } })
    }
  } catch (error) {
    console.error('LOGOUT SESSION CLEANUP ERROR:', error)
    // A DB outage must not falsely claim that the still-valid token was revoked.
    return NextResponse.json({ message: 'Unable to end session. Please try again.' }, {
      status: 503, headers: PRIVATE_CACHE_HEADERS,
    })
  }

  const response = new NextResponse(null, { status: 303, headers: { Location: '/login' } })
  for (const [name, value] of Object.entries(PRIVATE_CACHE_HEADERS)) {
    response.headers.set(name, value)
  }
  // Clears old cached responses where supported; does not replace server auth.
  response.headers.set('Clear-Site-Data', '"cache"')
  for (const cookieName of [SESSION_COOKIE, MFA_PENDING_COOKIE, 'token']) {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    })
  }
  return response
}
