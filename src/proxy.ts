import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'parish_session'

const protectedPrefixes = [
  '/dashboard',
  '/admin',
  '/burial-admin',
  '/complete-profile',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = protectedPrefixes.some(prefix =>
    pathname.startsWith(prefix)
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  // This is only a fast cookie-presence boundary. The protected
  // layouts and APIs still verify the database-backed session and role.
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
    '/complete-profile/:path*',
  ],
}
