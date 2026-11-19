import { NextRequest, NextResponse } from 'next/server'
import { destroySessionToken, SESSION_COOKIE } from '@/lib/auth'
import { MFA_PENDING_COOKIE, findValidStaffChallenge } from '@/lib/staffMfa'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value
  const pendingToken = request.cookies.get(MFA_PENDING_COOKIE)?.value

  try {
    await destroySessionToken(sessionToken)
    // Cancel an unfinished first-factor sign-in as well.
    const challenge = await findValidStaffChallenge(pendingToken)
    if (challenge) {
      await prisma.staffMfaChallenge.deleteMany({ where: { id: challenge.id } })
    }
  } catch (error) {
    console.error('LOGOUT SESSION CLEANUP ERROR:', error)
    // Never report successful logout while server-side session revocation failed.
    return NextResponse.json({ message: 'Unable to end session. Try again.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const response = NextResponse.json(
    { message: 'Logged out.' },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  for (const cookieName of [SESSION_COOKIE, MFA_PENDING_COOKIE, 'token']) {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })
  }

  return response
}
