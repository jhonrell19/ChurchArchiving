import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import {
  createSession,
  isUserProfileComplete,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/validation'

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

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
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
            'Please verify your email address or use Phone Sign In before signing in.',
          verificationRequired: true,
        },
        { status: 403 }
      )
    }

    const needsProfileCompletion =
      user.role === 'USER' &&
      !isUserProfileComplete(user)

    const { token } = await createSession(user.id)

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
      maxAge: SESSION_MAX_AGE_SECONDS,
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
