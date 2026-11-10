import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const response = (error: string, status: number) => NextResponse.json({ error }, { status })

// PayMongo signs the unmodified raw request body: HMAC-SHA256(timestamp + '.' + body).
export async function POST(req: NextRequest) {
  const mode = process.env.PAYMONGO_MODE === 'live' ? 'live' : 'test'
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  const key = process.env.FLASK_INTERNAL_KEY
  const api = process.env.FLASK_API_URL
  if (!secret || !key || !api) return response('Webhook not configured', 503)
  if (mode === 'live' && (process.env.SMART_PARISH_ENV !== 'production' ||
      process.env.PAYMONGO_LIVE_ENABLED !== 'YES' || process.env.CERT_FEES_APPROVED !== 'YES')) {
    return response('Live payments not authorized', 503)
  }

  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 1024 * 1024) return response('Payload too large', 413)
  const raw = await req.text()
  if (Buffer.byteLength(raw) > 1024 * 1024) return response('Payload too large', 413)
  const components = Object.fromEntries((req.headers.get('paymongo-signature') || '')
    .split(',').map(s => s.trim().split('=', 2)).filter(([name, value]) => name && value))
  if (!/^\d{9,15}$/.test(components.t || '')) return response('Invalid signature timestamp', 401)
  const timestamp = Number(components.t)
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return response('Expired signature', 401)
  const expected = createHmac('sha256', secret).update(`${components.t}.${raw}`).digest()
  const hexSignature = mode === 'live' ? components.li : components.te
  if (typeof hexSignature !== 'string' || !/^[0-9a-f]{64}$/i.test(hexSignature)) {
    return response('Invalid signature', 401)
  }
  const received = Buffer.from(hexSignature, 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return response('Invalid signature', 401)
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { return response('Invalid JSON', 400) }
  // Supports PayMongo's current Payment Channels envelope and its older event shape.
  const event = payload?.data?.type === 'checkout_session.payment.paid'
    ? payload.data : payload?.data?.attributes
  if (!event || event.livemode !== (mode === 'live')) return response('Payment mode mismatch', 400)
  if (event.type !== 'checkout_session.payment.paid') return NextResponse.json({ received: true })
  const checkoutSessionId = event?.data?.id
  if (typeof checkoutSessionId !== 'string' || !/^cs_[a-zA-Z0-9_-]+$/.test(checkoutSessionId)) {
    return response('Checkout session missing', 400)
  }
  try {
    const upstream = await fetch(new URL('/api/paymongo/confirm-internal', api), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': key, 'X-User-Role': 'PAYMONGO_WEBHOOK' },
      body: JSON.stringify({ checkoutSessionId, mode }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    if (!upstream.ok) return response('Payment verification pending', 503)
    return NextResponse.json({ received: true })
  } catch {
    return response('Payment verification pending', 503)
  }
}
