/**
 * Server-side access policy for the browser entry point.
 *
 * These checks run before rendering. The page layouts and API handlers still
 * perform their own database and resource-level authorization (defence in depth).
 * Defaults are DENY-UNTIL-AUTHENTICATED for future /api endpoints.
 */
export type PolicyRole = 'USER' | 'ADMIN' | 'STAFF' | 'BURIAL_ADMIN'
export type AccessRule = {
  kind: 'page' | 'api'
  roles: readonly PolicyRole[]
}

const ALL_ROLES: readonly PolicyRole[] = ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN']
const STAFF_ROLES: readonly PolicyRole[] = ['STAFF', 'BURIAL_ADMIN']
const OFFICE_ROLES: readonly PolicyRole[] = ['ADMIN', 'STAFF', 'BURIAL_ADMIN']

const PUBLIC_API_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/resend-verification',
  '/api/auth/verify-email',
  '/api/auth/logout', // must work even for expired cookies
  '/api/auth/staff-mfa', // verified separately against a short-lived MFA challenge
  '/api/verification', // pending membership evidence uses a separate token
  '/api/paymongo/webhook', // verified by PayMongo HMAC, never a browser cookie
  '/api/public-notices',
  '/api/parish-calendar',
  '/api/portal-config',
  '/api/location/ph',
  '/api/ready',
])

function under(path: string, root: string) {
  return path === root || path.startsWith(root + '/')
}

export function accessRule(pathname: string): AccessRule | null {
  // Private browser documents. Do not rely on React component visibility.
  if (under(pathname, '/admin'))
    return { kind: 'page', roles: ['ADMIN'] }
  if (under(pathname, '/staff'))
    return { kind: 'page', roles: STAFF_ROLES }
  if (under(pathname, '/burial-admin'))
    return { kind: 'page', roles: STAFF_ROLES }
  if (under(pathname, '/dashboard') || under(pathname, '/complete-profile'))
    return { kind: 'page', roles: ['USER'] }
  if (under(pathname, '/office-reports'))
    return { kind: 'page', roles: OFFICE_ROLES }
  if (under(pathname, '/claims') || under(pathname, '/appointments'))
    return { kind: 'page', roles: ALL_ROLES }

  if (!under(pathname, '/api')) return null

  if (PUBLIC_API_ROUTES.has(pathname) || under(pathname, '/api/notice-media'))
    return null

  // Staff can dispatch certificate/payment notices, but only Super Admin can
  // edit public announcements or manage staff accounts.
  if (pathname === '/api/admin/notifications/dispatch')
    return { kind: 'api', roles: STAFF_ROLES }
  if (under(pathname, '/api/admin'))
    return { kind: 'api', roles: ['ADMIN'] }

  if (under(pathname, '/api/notifications') ||
      pathname === '/api/auth/profile' ||
      pathname === '/api/auth/complete-profile' ||
      pathname === '/api/auth/phone-otp')
    return { kind: 'api', roles: ['USER'] }

  // The Flask proxy enforces finer-grained operation permissions by role
  // and the Flask backend verifies request ownership before returning data.
  return { kind: 'api', roles: ALL_ROLES }
}

export function roleCanAccess(rule: AccessRule, role: string) {
  return rule.roles.includes(role as PolicyRole)
}

/** Applied to all authenticated HTML and API responses, including redirects. */
export const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
} as const
