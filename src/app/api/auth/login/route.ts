import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  createSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return NextResponse.json(
        { message: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const { token } = await createSession(user.id)

    const response = NextResponse.json(
      {
        message: 'Login successful.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          surname: user.surname,
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

    // Remove the legacy JWT cookie so old ADMIN tokens cannot keep affecting tests.
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
