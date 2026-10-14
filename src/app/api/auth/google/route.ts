import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { NextResponse } from 'next/server'

import {
  createSession,
  isUserProfileComplete,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/validation'

const googleClientId = process.env.GOOGLE_CLIENT_ID

type GoogleAuthIntent = 'login' | 'register'

export async function POST(request: Request) {
  try {
    if (!googleClientId) {
      console.error(
        'GOOGLE AUTH ERROR: GOOGLE_CLIENT_ID is missing.'
      )

      return NextResponse.json(
        {
          message:
            'Google authentication is not configured on the server.',
        },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)

    const credential =
      typeof body?.credential === 'string'
        ? body.credential.trim()
        : ''

    const intent: GoogleAuthIntent =
      body?.intent === 'register' ? 'register' : 'login'

    if (!credential) {
      return NextResponse.json(
        { message: 'Google credential is required.' },
        { status: 400 }
      )
    }

    const googleClient = new OAuth2Client(googleClientId)

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    })

    const payload = ticket.getPayload()

    if (!payload) {
      return NextResponse.json(
        {
          message: 'Google account could not be verified.',
        },
        { status: 401 }
      )
    }

    const googleSub = payload.sub
    const email = normalizeEmail(payload.email)

    if (
      !googleSub ||
      !email ||
      payload.email_verified !== true
    ) {
      return NextResponse.json(
        {
          message:
            'A verified Google email address is required.',
        },
        { status: 401 }
      )
    }

    // Prefer the stable Google account identifier first.
    let user = await prisma.user.findUnique({
      where: { googleSub },
    })

    // If not previously linked, use the verified Google email to find
    // the same parishioner account and link it instead of duplicating it.
    if (!user) {
      const existingEmailUser =
        await prisma.user.findUnique({
          where: { email },
        })

      if (existingEmailUser) {
        if (existingEmailUser.role !== 'USER') {
          return NextResponse.json(
            {
              message:
                'Staff accounts cannot use public Google authentication. Please use the normal staff login.',
            },
            { status: 403 }
          )
        }

        if (
          existingEmailUser.googleSub &&
          existingEmailUser.googleSub !== googleSub
        ) {
          return NextResponse.json(
            {
              message:
                'This parish account is already connected to another Google account.',
            },
            { status: 409 }
          )
        }

        user = await prisma.user.update({
          where: { id: existingEmailUser.id },
          data: {
            googleSub,
            emailVerified: true,
            firstName:
              existingEmailUser.firstName ||
              payload.given_name?.trim() ||
              null,
            surname:
              existingEmailUser.surname ||
              payload.family_name?.trim() ||
              null,
          },
        })
      }
    }

    // Login is intentionally different from registration: the login page
    // must not silently create a brand-new parish account.
    if (!user && intent === 'login') {
      return NextResponse.json(
        {
          message:
            'No parish account is registered with this Google account yet. Please use Register first.',
        },
        { status: 404 }
      )
    }

    // Registration may create a new normal USER only.
    if (!user) {
      const randomPassword =
        randomBytes(48).toString('base64url')

      const passwordHash = await bcrypt.hash(
        randomPassword,
        12
      )

      user = await prisma.user.create({
        data: {
          email,
          password: passwordHash,
          firstName: payload.given_name?.trim() || null,
          surname: payload.family_name?.trim() || null,
          role: 'USER',
          emailVerified: true,
          googleSub,
        },
      })
    }

    if (user.role !== 'USER') {
      return NextResponse.json(
        {
          message:
            'Google authentication is available only for parishioner accounts.',
        },
        { status: 403 }
      )
    }

    const needsProfileCompletion =
      !isUserProfileComplete(user)

    const { token } = await createSession(user.id)

    const response = NextResponse.json(
      {
        message: needsProfileCompletion
          ? 'Google account verified. Please complete your parish profile.'
          : 'Google authentication successful.',
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
    console.error('GOOGLE AUTH ERROR:', error)

    return NextResponse.json(
      {
        message:
          'Google authentication could not be completed.',
      },
      { status: 500 }
    )
  }
}
