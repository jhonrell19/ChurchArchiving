import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, validateSessionToken } from '@/lib/sessionValidation'
import { accessRule, PRIVATE_CACHE_HEADERS, roleCanAccess } from '@/lib/routeAccess'

function privateHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(PRIVATE_CACHE_HEADERS)) response.headers.set(key, value)
  return response
}

/**
 * Next.js 16 Proxy uses the Node runtime: verify revocable PostgreSQL sessions
 * BEFORE protected HTML/RSC/API responses. A cookie's mere presence is never
 * sufficient. Layouts and API handlers verify again for defence in depth.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname === '/api' || pathname.startsWith('/api/')
  const originBound = isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())
  const signedCleanup = pathname === '/api/admin/notices/cleanup' &&
    request.method.toUpperCase() === 'POST' &&
    (request.headers.get('authorization') || '').startsWith('Bearer ')

  // CSRF guard for cookies on all state-changing browser APIs. The only
  // exceptions use HMAC/Bearer secrets checked inside their route handlers.
  if (originBound && pathname !== '/api/paymongo/webhook' && !signedCleanup) {
    const origin = request.headers.get('origin')
    const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
    const production = process.env.NODE_ENV === 'production'
    const permitted = production ? [configured] : [request.nextUrl.origin, configured]
    const site = request.headers.get('sec-fetch-site')

    if (site === 'cross-site' ||
        (origin && !permitted.includes(origin)) ||
        (production && (!configured || !origin || origin !== configured))) {
      return privateHeaders(NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 }))
    }
  }

  // GitHub scheduled cleanup: Bearer authorization is validated by the cleanup
  // handler using a constant-time digest check. Never treat it as a user session.
  if (signedCleanup) return privateHeaders(NextResponse.next())

  const rule = accessRule(pathname)
  if (!rule) {
    const response = NextResponse.next()
    if (isApi || pathname === '/login' || pathname === '/staff-mfa' || pathname === '/verification')
      return privateHeaders(response)
    return response
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (rule.kind === 'api')
      return privateHeaders(NextResponse.json({ message: 'Authentication required.' }, { status: 401 }))

    const target = new URL('/login', request.url)
    const response = NextResponse.redirect(target)
    return privateHeaders(response)
  }

  try {
    const user = await validateSessionToken(token)
    if (!user) {
      const response = rule.kind === 'api'
        ? NextResponse.json({ message: 'Session expired or revoked.' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', path: '/', maxAge: 0,
      })
      return privateHeaders(response)
    }

    if (!roleCanAccess(rule, user.role)) {
      return privateHeaders(rule.kind === 'api'
        ? NextResponse.json({ message: 'Forbidden.' }, { status: 403 })
        : new NextResponse('403 Forbidden: You do not have access to this parish workspace.', {
            status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          }))
    }

    return privateHeaders(NextResponse.next())
  } catch (error) {
    // Database failures must never fall through to protected UI or data.
    console.error('Protected route session lookup failed:', pathname)
    return privateHeaders(rule.kind === 'api'
      ? NextResponse.json({ message: 'Session verification is temporarily unavailable.' }, { status: 503 })
      : new NextResponse('503: Secure session verification is temporarily unavailable.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }))
  }
}

export const config = {
  matcher: [
    '/login',
    '/staff-mfa',
    '/verification',
    '/dashboard/:path*',
    '/admin/:path*',
    '/burial-admin/:path*',
    '/staff/:path*',
    '/complete-profile/:path*',
    '/office-reports/:path*',
    '/claims/:path*',
    '/appointments/:path*',
    '/api/:path*',
  ],
}
