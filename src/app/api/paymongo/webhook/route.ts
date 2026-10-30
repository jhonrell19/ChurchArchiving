import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  const key = process.env.FLASK_INTERNAL_KEY
  const api = process.env.FLASK_API_URL
  if (!secret || !key || !api) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const raw = await req.text()
  const parts = Object.fromEntries((req.headers.get('paymongo-signature') || '').split(',').map(s => s.trim().split('=',2)))
  const ts = Number(parts.t)
  if (!Number.isFinite(ts) || Math.abs(Date.now()/1000 - ts) > 300) return NextResponse.json({ error: 'Expired signature' }, { status: 401 })
  // TEST mode only. Reject all live-mode signatures.
  const expected = createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex')
  const actual = parts.te || ''
  const good = actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  if (!good) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  let obj: any
  try { obj = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  // Support the new Payment Channels event envelope and the legacy event envelope.
  const event = obj?.data?.type === 'checkout_session.payment.paid' ? obj.data : obj?.data?.attributes
  if (event?.livemode !== false) return NextResponse.json({ error: 'Only test mode supported' }, { status: 400 })
  if (event?.type !== 'checkout_session.payment.paid') return NextResponse.json({ received: true })
  const sessionId = event?.data?.id
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Session missing' }, { status: 400 })
  try {
    const upstream = await fetch(new URL('/api/paymongo/confirm-internal', api), {
      method:'POST', headers: {'Content-Type':'application/json','X-Internal-Key':key,'X-User-Role':'PAYMONGO_WEBHOOK'},
      body:JSON.stringify({checkoutSessionId: sessionId}), cache:'no-store',
    })
    if (!upstream.ok) return NextResponse.json({ error: 'Confirmation pending' }, { status: 503 })
    return NextResponse.json({ received: true })
  } catch { return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 }) }
}
