import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { NextResponse } from 'next/server'

import {
  createSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/validation'

const googleClientId = process.env.GOOGLE_CLIENT_ID

export async function POST(request: Request) {
  try {
    /*
     * 1. Make sure Google authentication is configured on the server.
     */
    if (!googleClientId) {
      console.error('GOOGLE LOGIN ERROR: GOOGLE_CLIENT_ID is missing.')

      return NextResponse.json(
        {
          message:
            'Google Sign-In is not configured on the server.',
        },
        { status: 500 }
      )
    }

    /*
     * 2. Read the Google credential sent by the login page.
     */
    const body = await request.json().catch(() => null)

    const credential =
      typeof body?.credential === 'string'
        ? body.credential.trim()
        : ''

    if (!credential) {
      return NextResponse.json(
        {
          message: 'Google credential is required.',
        },
        { status: 400 }
      )
    }

    /*
     * 3. Verify the credential directly with Google's library.
     *
     * We DO NOT trust an email address sent by the browser.
     * Google's signed ID token must pass verification first.
     */
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

    /*
     * Google's "sub" is the permanent Google account identifier.
     */
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

    /*
     * 4. First see whether this exact Google account
     * has already been linked.
     */
    let user = await prisma.user.findUnique({
      where: {
        googleSub,
      },
    })

    /*
     * 5. If the Google account has never been linked,
     * check whether a normal USER already owns this email.
     *
     * This lets someone who originally registered using
     * email/password later use Google without creating a
     * duplicate account.
     */
    if (!user) {
      const existingEmailUser =
        await prisma.user.findUnique({
          where: {
            email,
          },
        })

      if (existingEmailUser) {
        /*
         * Never allow a public Google login to connect itself
         * to a staff account.
         */
        if (existingEmailUser.role !== 'USER') {
          return NextResponse.json(
            {
              message:
                'Staff accounts cannot use public Google Sign-In. Please use the normal staff login.',
            },
            { status: 403 }
          )
        }

        /*
         * Prevent one local account from being attached to
         * two different Google identities.
         */
        if (
          existingEmailUser.googleSub &&
          existingEmailUser.googleSub !== googleSub
        ) {
          return NextResponse.json(
            {
              message:
                'This email is already connected to another Google account.',
            },
            { status: 409 }
          )
        }

        /*
         * Link Google to the existing USER account.
         */
        user = await prisma.user.update({
          where: {
            id: existingEmailUser.id,
          },
          data: {
            googleSub,
            emailVerified: true,

            /*
             * Only fill names from Google if the existing
             * account does not already have them.
             */
            firstName:
              existingEmailUser.firstName ||
              payload.given_name?.trim() ||
              payload.name?.trim() ||
              null,

            surname:
              existingEmailUser.surname ||
              payload.family_name?.trim() ||
              null,
          },
        })
      }
    }

    /*
     * 6. If no account exists at all, create a normal USER.
     *
     * The generated password is random and unknown to the user.
     * It is still hashed so no plaintext credential is stored.
     *
     * The user may later create a normal password through
     * your Forgot Password system if needed.
     */
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

          firstName:
            payload.given_name?.trim() ||
            payload.name?.trim() ||
            null,

          surname:
            payload.family_name?.trim() ||
            null,

          role: 'USER',

          emailVerified: true,

          googleSub,
        },
      })
    }

    /*
     * 7. Final defense:
     *
     * Public Google authentication must never produce
     * an ADMIN or BURIAL_ADMIN session.
     */
    if (user.role !== 'USER') {
      return NextResponse.json(
        {
          message:
            'Google Sign-In is available only for parishioner accounts.',
        },
        { status: 403 }
      )
    }

    /*
     * 8. Use the SAME session system as normal email/password login.
     */
    const { token } = await createSession(user.id)

    const response = NextResponse.json(
      {
        message: 'Google login successful.',
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
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )

    /*
     * 9. Store our secure database-backed parish session.
     */
    response.cookies.set(
      SESSION_COOKIE,
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      }
    )

    /*
     * Remove the old legacy JWT cookie if one still exists.
     */
    response.cookies.set('token', '', {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })

    return response
  } catch (error) {
    console.error(
      'GOOGLE LOGIN ERROR:',
      error
    )

    return NextResponse.json(
      {
        message:
          'Google login could not be completed.',
      },
      { status: 500 }
    )
  }
}