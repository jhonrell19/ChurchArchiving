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

    if (role === 'ADMIN' && BURIAL_ARCHIVE_TYPES.has(category)) {
      return false
    }

    if (role === 'BURIAL_ADMIN' && MAIN_ARCHIVE_TYPES.has(category)) {
      return false
    }
  }

  if (path.startsWith('files/') || path.startsWith('download/')) {
    return true
  }

  if (path === 'api/health') {
    return m === 'GET'
  }

  if (path.startsWith('api/cemetery/')) {
    return role === 'BURIAL_ADMIN'
  }

  if (path.startsWith('api/user/')) {
    return role === 'USER' && m === 'GET'
  }

  if (path === 'api/requests/pricing') return m === 'GET' && ['USER', 'ADMIN', 'BURIAL_ADMIN'].includes(role)

  if (path === 'api/requests') {
    if (m === 'POST') return role === 'USER'
    if (m === 'GET') return ['USER', 'ADMIN', 'BURIAL_ADMIN'].includes(role)
    return false
  }

  if (/^api\/requests\/\d+\/(cancel|hide)$/.test(path)) {
    return m === 'POST' && role === 'USER'
  }

  if (/^api\/requests\/\d+$/.test(path)) {
    return m === 'GET' && ['USER', 'ADMIN', 'BURIAL_ADMIN'].includes(role)
  }

if (
  /^api\/requests\/\d+\/paymongo-checkout$/.test(path)
) {
  return m === 'POST' && role === 'USER'
}

  if (/^api\/requests\/\d+\/(status|attach-document|select-record)$/.test(path)) {
    return m === 'PATCH' && ['ADMIN', 'BURIAL_ADMIN'].includes(role)
  }

  if (/^api\/requests\/\d+\/(release-document|generate-document)$/.test(path)) {
    return m === 'POST' && ['ADMIN', 'BURIAL_ADMIN'].includes(role)
  }

  if (/^api\/requests\/\d+\/download$/.test(path)) {
    return m === 'GET' && ['USER', 'ADMIN', 'BURIAL_ADMIN'].includes(role)
  }

  if (path === 'api/archive/audit-logs') {
    return m === 'GET' && role === 'ADMIN'
  }

  if (path.startsWith('api/archive/')) {
    return ['ADMIN', 'BURIAL_ADMIN'].includes(role)
  }

  if (path === 'api/masses') {
    if (m === 'GET') return role === 'USER' || role === 'ADMIN'
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

  if (role === 'ADMIN') {
    url.searchParams.set('scope', 'main')
  } else if (role === 'BURIAL_ADMIN') {
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

  headers.set('x-internal-key', internalKey)
  headers.set('x-user-id', String(user.id))
  headers.set('x-user-role', user.role)
  headers.set('x-user-email', user.email)
  headers.set('x-user-name', fullName || user.email)
  headers.set('x-user-phone', user.phoneNumber || '')

  headers.set(
  'x-user-address',
  user.address || ''
)

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

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    })

    const responseHeaders = new Headers()
    for (const key of [
      'content-type',
      'content-disposition',
      'content-length',
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

    return new NextResponse(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
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
