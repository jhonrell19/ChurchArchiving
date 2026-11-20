import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const cookieName = 'parish_evidence_access'
const lifetime = 15 * 60
export const evidenceEnabled = () => process.env.PARISH_MEMBERSHIP_EVIDENCE === 'enabled'
function signature(payload: string) {
  const secret = process.env.FLASK_INTERNAL_KEY
  if (!secret) throw Error('Missing internal signing key')
  return createHmac('sha256', secret).update('evidence-v1:' + payload).digest('hex')
}

export function pendingEvidenceResponse(userId: number) {
  const payload = userId + '.' + (Math.floor(Date.now() / 1000) + lifetime)
  const response = NextResponse.json({ evidenceRequired: true, message: 'Submit parish membership evidence.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(cookieName, payload + '.' + signature(payload), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/api/verification', maxAge: lifetime,
  })
  return response
}

export function evidenceUserId(req: NextRequest) {
  if (!evidenceEnabled()) return null
  const token = req.cookies.get(cookieName)?.value || ''
  const match = /^(\d{1,10})\.(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!match || Number(match[2]) <= Math.floor(Date.now() / 1000)) return null
  if (!timingSafeEqual(Buffer.from(match[3]), Buffer.from(signature(match[1]+'.'+match[2])))) return null
  return Number(match[1])
}
