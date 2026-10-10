import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'parish_session'

const protectedPrefixes = ['/dashboard', '/admin', '/burial-admin']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (!isProtected) {
    return NextResponse.next()
  }

  // Fast boundary check only. Real authorization is repeated inside
  // protected server layouts and APIs using the database-backed session.
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/burial-admin/:path*',
  ],
}
