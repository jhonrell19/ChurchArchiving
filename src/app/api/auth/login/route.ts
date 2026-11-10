import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import {
  createSession,
  isUserProfileComplete,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STAFF_SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MFA_PENDING_COOKIE, MFA_PENDING_MAX_AGE, issueStaffMfaChallenge, mfaKeyConfigured } from '@/lib/staffMfa'
import { normalizeEmail } from '@/lib/validation'
import { loginAllowed, loginFailed, loginSucceeded } from '@/lib/loginThrottle'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    const password =
      typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required.' },
        { status: 400 }
      )
    }

    if (!loginAllowed(email)) {
      return NextResponse.json({ message: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': '900' } })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      loginFailed(email)
      return NextResponse.json(
        { message: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    if (
  user.role === 'USER' &&
  !user.emailVerified &&
  !user.googleSub
) {
      return NextResponse.json(
        {
          message:
            'Please verify your email address before signing in.',
          verificationRequired: true,
        },
        { status: 403 }
      )
    }

    if (user.role !== 'USER' && !user.emailVerified) {
      return NextResponse.json({ message: 'Staff account requires verification.' }, { status: 403 })
    }

    // Password alone must NEVER grant staff a full browser session.
    if (user.role !== 'USER') {
      if (!mfaKeyConfigured()) {
        return NextResponse.json({ message: 'Staff MFA is not configured on this server. Contact the system administrator.' }, { status: 503 })
      }
      const pendingToken = await issueStaffMfaChallenge(user.id)
      loginSucceeded(email)
      const response = NextResponse.json(
        { message: 'Complete authenticator verification.', mfaRequired: true },
        { headers: { 'Cache-Control': 'no-store' } }
      )
      response.cookies.set(MFA_PENDING_COOKIE, pendingToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/', maxAge: MFA_PENDING_MAX_AGE,
      })
      return response
    }

    loginSucceeded(email)
    const needsProfileCompletion =
      user.role === 'USER' &&
      !isUserProfileComplete(user)

    const { token } = await createSession(user.id, user.role !== 'USER')

    const response = NextResponse.json(
      {
        message: 'Login successful.',
        needsProfileCompletion,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          middleName: user.middleName,
          surname: user.surname,
          phoneNumber: user.phoneNumber,
          address: user.address,
          emailVerified: user.emailVerified,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: user.role === 'USER' ? SESSION_MAX_AGE_SECONDS : STAFF_SESSION_MAX_AGE_SECONDS,
    })

    response.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })

    return response
  } catch (error) {
    console.error('LOGIN ERROR:', error)

    return NextResponse.json(
      { message: 'Login failed.' },
      { status: 500 }
    )
  }
}
