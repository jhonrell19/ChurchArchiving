import { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'

const MAIN_ARCHIVE_TYPES = new Set(['baptismal', 'confirmation', 'marriage'])
const BURIAL_ARCHIVE_TYPES = new Set(['burial', 'land_agreement', 'ownership'])

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'cookie',
  'content-length',
  'accept-encoding',
])

function isAllowed(role: Role, method: string, path: string) {
  const m = method.toUpperCase()

  const archiveCategoryMatch = path.match(
    /^api\/archive\/documents\/([^/]+)$/
  )

  if (archiveCategoryMatch) {
    const category = decodeURIComponent(archiveCategoryMatch[1])

    if (role === 'BURIAL_ADMIN' && MAIN_ARCHIVE_TYPES.has(category)) {
      return false
    }
  }

  if (path.startsWith('files/') || path.startsWith('download/')) {
    return true
  }

  if (/^api\/requests\/\d+\/identity-proof$/.test(path)) return m === 'GET' && ['STAFF','BURIAL_ADMIN'].includes(role)
  if (/^api\/requests\/\d+\/payment-result$/.test(path)) return m === 'POST' && role === 'USER'
  if (path === 'api/appointments') return m === 'GET' || m === 'POST'
  if (path === 'api/claims') return m === 'GET' || (m === 'POST' && role === 'USER')
  if (/^api\/claims\/\d+\/proof$/.test(path)) return m === 'GET' && role !== 'USER'
  if (/^api\/claims\/\d+\/review$/.test(path)) return m === 'POST' && role !== 'USER'

  if (path === 'api/reports/members' || path === 'api/reports/schedules') return role === 'ADMIN' && (m === 'GET' || m === 'POST')
  if (/^api\/reports\/schedules\/\d+\/latest$/.test(path)) return role === 'ADMIN' && m === 'GET'
  if (path === 'api/reports/certificates') return m === 'GET' && (role === 'ADMIN' || role === 'STAFF' || role === 'BURIAL_ADMIN')

  if (path === 'api/health') {
    return m === 'GET'
  }

  if (path.startsWith('api/cemetery/')) {
    if (role === 'STAFF') {
      return m === 'GET' && (path === 'api/cemetery/burials' ||
        path.startsWith('api/cemetery/files/'))
    }
    return role === 'BURIAL_ADMIN'
  }

  if (path.startsWith('api/user/')) {
    return role === 'USER' && m === 'GET'
  }

   if (path === 'api/requests/pricing') {
    if (m === 'GET') {
      return ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN'].includes(role)
    }

    if (m === 'PATCH') {
      return role === 'ADMIN'
    }

    return false
  }

  if (path === 'api/requests') {
    if (m === 'POST') return role === 'USER'
    if (m === 'GET') return ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN'].includes(role)
    return false
  }

  if (/^api\/requests\/\d+\/(cancel|hide)$/.test(path)) {
    return m === 'POST' && role === 'USER'
  }

  if (/^api\/requests\/\d+$/.test(path)) {
    return m === 'GET' && ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN'].includes(role)
  }

if (
  /^api\/requests\/\d+\/paymongo-checkout$/.test(path)
) {
  return m === 'POST' && role === 'USER'
}

  if (/^api\/requests\/\d+\/cash-receipt$/.test(path)) {
    return m === 'POST' && ['STAFF', 'BURIAL_ADMIN'].includes(role)
  }

  if (/^api\/requests\/\d+\/(status|attach-document|select-record)$/.test(path)) {
    return m === 'PATCH' && ['STAFF', 'BURIAL_ADMIN'].includes(role)
  }

  if (/^api\/requests\/\d+\/(release-document|generate-document)$/.test(path)) {
    return m === 'POST' && ['STAFF', 'BURIAL_ADMIN'].includes(role)
  }

  if (/^api\/requests\/\d+\/download$/.test(path)) {
    return m === 'GET' && ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN'].includes(role)
  }

  if (path === 'api/office/audit-logs') return m === 'GET' && role === 'ADMIN'
  if (path.startsWith('api/archive/')) {
    if (['api/archive/deleted-documents', 'api/archive/audit-logs'].includes(path)) return false
    if (/\/(delete|restore)$/.test(path)) return false
    return role === 'STAFF' || role === 'BURIAL_ADMIN'
  }

  if (path === 'api/masses') {
    if (m === 'GET') return ['USER', 'ADMIN', 'STAFF', 'BURIAL_ADMIN'].includes(role)
    return role === 'ADMIN'
  }

  if (path.startsWith('api/masses/')) {
    return role === 'ADMIN'
  }

  if (path === 'api/transcriptions') {
    return m === 'GET' && (role === 'USER' || role === 'ADMIN')
  }

  if (path === 'api/announcements') {
    if (m === 'GET') return role === 'USER' || role === 'ADMIN'
    return role === 'ADMIN'
  }

  if (path.startsWith('api/announcements/')) {
    return role === 'ADMIN'
  }

  return false
}

function forceRoleScope(url: URL, role: Role, path: string) {
  const scopedPaths = new Set([
    'api/requests',
    'api/archive/documents',
    'api/archive/deleted-documents',
  ])

  if (!scopedPaths.has(path)) return

  if (role === 'BURIAL_ADMIN') {
    url.searchParams.set('scope', 'burial')
  } else {
    url.searchParams.delete('scope')
  }
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { path: segments } = await context.params
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/%?#]/.test(segment))) {
    return NextResponse.json({error:'Invalid path'}, {status:400})
  }
  const path = segments.join('/')

  if (!isAllowed(user.role, request.method, path)) {
    return NextResponse.json({ message: 'Forbidden.' }, { status: 403 })
  }

  const flaskBase = process.env.FLASK_API_URL
  const internalKey = process.env.FLASK_INTERNAL_KEY

  if (!flaskBase || !internalKey) {
    console.error('BACKEND PROXY ERROR: FLASK_API_URL or FLASK_INTERNAL_KEY is missing.')
    return NextResponse.json(
      { message: 'Backend service is not configured.' },
      { status: 500 }
    )
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`/${path}`, flaskBase)
  upstreamUrl.search = incomingUrl.search
  forceRoleScope(upstreamUrl, user.role, path)

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  const fullName = [user.firstName, user.middleName, user.surname]
    .filter(Boolean)
    .join(' ')
    .trim()

  // Request a plain upstream representation; Node fetch may transparently
  // decompress compressed responses before we forward the body.
  headers.set('accept-encoding', 'identity')

  headers.set('x-internal-key', internalKey)
  headers.set('x-user-id', String(user.id))
  headers.set('x-user-role', user.role)
  headers.set('x-user-email', user.email)
  headers.set('x-user-name', fullName || user.email)
  headers.set('x-user-phone', user.phoneNumber || '')


  // Allow a free instance to wake. Restrict the deadline to interactive reads.
  const interactiveRead = request.method === 'GET' && (path.startsWith('api/archive/documents/') || [
    'api/health', 'api/requests', 'api/archive/documents', 'api/announcements',
    'api/user/dashboard-summary', 'api/masses', 'api/transcriptions', 'api/archive/deleted-documents',
  ].includes(path))
  const deadline = interactiveRead ? AbortSignal.timeout(90_000) : undefined
  try {
    // Mass creation uses multipart/form-data. Re-encode its parts instead of
    // forwarding a raw byte buffer with an inherited boundary header: the
    // upstream Flask parser must receive a matching Content-Type/boundary.
    // All other API endpoints retain their existing forwarding behavior.
    let body: ArrayBuffer | FormData | undefined
    if (['GET', 'HEAD'].includes(request.method.toUpperCase())) {
      body = undefined
    } else if (
      path === 'api/masses' &&
      request.method.toUpperCase() === 'POST' &&
      (request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')
    ) {
      const massForm = await request.formData()
      const title = massForm.get('title')

      if (typeof title !== 'string' || !title.trim()) {
        console.error('Mass upload: multipart title field missing at Next.js proxy.')
        return NextResponse.json(
          { error: 'Mass title was not received by the Next.js API. Check the form request payload.' },
          { status: 400 }
        )
      }

      // fetch() sets the correct multipart boundary for the new FormData.
      // Do NOT pass the browser's original Content-Type/boundary through.
      headers.delete('content-type')
      body = massForm
    } else {
      body = await request.arrayBuffer()
    }

    const send = () => fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: deadline,
    })

    let upstreamResponse: Response
    try {
      upstreamResponse = await send()
      if (interactiveRead && [502, 503, 504].includes(upstreamResponse.status)) {
        await upstreamResponse.body?.cancel()
        throw new Error('Temporary upstream failure')
      }
    } catch (error) {
      if (!interactiveRead || deadline?.aborted || request.signal.aborted) throw error
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (deadline?.aborted || request.signal.aborted) throw error
      upstreamResponse = await send()
    }

    // Post-commit notifications: ONLY the authoritative Flask response may
    // supply the request id/owner/status. This is not client-provided input.
    // Failure to enqueue/deliver must not change an approved request, payment,
    // or returned HTTP status.
    if (upstreamResponse.ok && process.env.PARISH_STATUS_NOTIFICATIONS === 'enabled') {
      const method = request.method.toUpperCase()
      const eventAction =
        (path === 'api/requests' && method === 'POST') ? 'submitted' :
        (/^api\/requests\/\d+\/status$/.test(path) && method === 'PATCH') ? 'status' :
        (/^api\/requests\/\d+\/release-document$/.test(path) && method === 'POST') ? 'ready' :
        (/^api\/requests\/\d+\/cash-receipt$/.test(path) && method === 'POST') ? 'payment' :
        (/^api\/requests\/\d+\/cancel$/.test(path) && method === 'POST') ? 'cancelled' :
        null
      if (eventAction) {
        try {
          const result = await upstreamResponse.clone().json()
          const snapshot = result?.request || (
            eventAction === 'payment' && result?.ok && Number.isSafeInteger(result.requestId)
              ? { id: result.requestId, requesterUserId: result.requesterUserId,
                  sacramentType: result.sacramentType, paymentStatus: result.paymentStatus,
                  paymentMethod: result.paymentMethod, paymentReference: result.paymentReference }
              : null
          )
          if (snapshot && Number.isSafeInteger(snapshot.id) &&
              snapshot.requesterUserId > 0) {
            const { queueRequestNotification } = await import('@/lib/statusNotifications')
            await queueRequestNotification(eventAction, snapshot)
          }
        } catch {
          // Preserve the staff mutation response. The outbox is additive and
          // a missing migration/Resend/txtBee must NEVER roll back a payment.
          console.warn('STATUS NOTICE: Could not record the post-commit event.')
        }
      }
    }

    const responseHeaders = new Headers()
    for (const key of [
      'content-type',
      'content-disposition',
      'retry-after',
      // Do not copy upstream Content-Length: fetch() may decompress the body,
      // making the original length stale and truncating JSON in the browser.
      'content-range',
      'accept-ranges',
      'cache-control',
      'last-modified',
      'etag',
    ]) {
      const value = upstreamResponse.headers.get(key)
      if (value) responseHeaders.set(key, value)
    }

    responseHeaders.set('Cache-Control', 'no-store')

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    if (deadline?.aborted) {
      return NextResponse.json({ message: 'The parish service took too long. Please try again.' }, { status: 504 })
    }
    console.error('BACKEND PROXY FETCH ERROR:', error)
    return NextResponse.json(
      { message: 'The parish backend service is unavailable.' },
      { status: 502 }
    )
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
