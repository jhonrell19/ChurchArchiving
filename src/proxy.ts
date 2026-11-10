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
  // Browser-origin boundary for cookie-authenticated mutations. This does not
  // replace auth/role checks in application routes or proxy-level rate limits.
  if (pathname.startsWith('/api/') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()) &&
      pathname !== '/api/paymongo/webhook') {
    const origin = request.headers.get('origin')
    const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
    const production = process.env.NODE_ENV === 'production'
    // ngrok terminates HTTPS while the local dev server may see localhost internally.
    // Trust ONLY the explicitly configured public URL, never wildcard ngrok domains.
    const allowed = production ? [configured] : [request.nextUrl.origin, configured]
    const site = request.headers.get('sec-fetch-site')
    if (site === 'cross-site' ||
        (origin && !allowed.includes(origin)) ||
        (production && (!configured || !origin || origin !== configured))) {
      return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 })
    }
  }


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
    '/api/:path*',
  ],
}
