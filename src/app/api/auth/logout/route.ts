import { NextRequest, NextResponse } from 'next/server'
import { destroySessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  try {
    await destroySessionToken(sessionToken)
  } catch (error) {
    console.error('LOGOUT SESSION CLEANUP ERROR:', error)
  }

  const response = NextResponse.json(
    { message: 'Logged out.' },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  for (const cookieName of [SESSION_COOKIE, 'token']) {
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
