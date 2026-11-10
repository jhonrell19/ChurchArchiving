import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const OTP_TTL_MS = 5 * 60 * 1000
const SEND_COOLDOWN_MS = 60 * 1000
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_SENDS_PER_DAY = 5
const MAX_ATTEMPTS = 5
const PHONE_E164_RE = /^\+639\d{9}$/
const noStore = { 'Cache-Control': 'no-store' }
const json = (obj: object, status = 200) => NextResponse.json(obj, { status, headers: noStore })

function configured() {
  return process.env.TEXTBEE_OTP_ENABLED === 'true' &&
    Boolean(process.env.TEXTBEE_API_KEY?.trim()) &&
    Boolean(process.env.PHONE_OTP_PEPPER && process.env.PHONE_OTP_PEPPER.length >= 32)
}
function otpHash(userId: number, phone: string, code: string) {
  const pepper = process.env.PHONE_OTP_PEPPER
  if (!pepper || pepper.length < 32) throw new Error('PHONE_OTP_PEPPER is not configured')
  return createHmac('sha256', pepper).update(`${userId}:${phone}:${code}`).digest('hex')
}
function equalHash(left: string, right: string) {
  return /^[0-9a-f]{64}$/.test(left) && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}
async function currentParishioner() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'USER' || !user.emailVerified) return null
  return user
}

export async function GET() {
  const user = await currentParishioner()
  if (!user) return json({ message: 'Verified parishioner login required.' }, 401)
  const record = await prisma.phoneVerification.findUnique({ where: { userId: user.id } })
  return json({
    configured: configured(),
    hasPhone: Boolean(user.phoneNumber),
    verified: Boolean(record?.verifiedAt && record.phoneNumber === user.phoneNumber),
    phoneEnding: user.phoneNumber?.slice(-4) || '',
  })
}

export async function POST(req: Request) {
  const user = await currentParishioner()
  if (!user) return json({ message: 'Verified parishioner login required.' }, 401)
  if (!user.phoneNumber || !PHONE_E164_RE.test(user.phoneNumber)) {
    return json({ message: 'Save a valid Philippine mobile number in your profile first.' }, 400)
  }
  const data = await req.json().catch(() => null)
  const action = typeof data?.action === 'string' ? data.action : ''
  const now = new Date()
  const current = await prisma.phoneVerification.findUnique({ where: { userId: user.id } })
  if (current?.phoneNumber === user.phoneNumber && current.verifiedAt) return json({ verified: true, message: 'Number already verified.' })

  if (action === 'send') {
    if (!configured()) return json({ message: 'SMS verification is not configured. Email verification remains available.' }, 503)
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const secretHash = otpHash(user.id, user.phoneNumber, code)
    const message = `Smart Parish verification code: ${code}. Expires in 5 minutes. Do not share this code.`
    // Reserve each SMS in a serialized database transaction to enforce cooldown
    // and daily quotas even if the same browser submits requests concurrently.
    const reservation = await prisma.$transaction(async tx => {
      const state = await tx.phoneVerification.findUnique({ where: { userId: user.id } })
      if (state?.phoneNumber === user.phoneNumber && state.verifiedAt) return 'verified'
      if (state?.lastSentAt && now.getTime() - state.lastSentAt.getTime() < SEND_COOLDOWN_MS) return 'cooldown'
      const sameWindow = Boolean(state?.sendWindowStart && now.getTime() - state.sendWindowStart.getTime() < SEND_WINDOW_MS)
      const attemptsInWindow = sameWindow ? (state?.sendsInWindow ?? 0) : 0
      if (attemptsInWindow >= MAX_SENDS_PER_DAY) return 'limit'
      const record = {
        phoneNumber: user.phoneNumber!,
        otpHash: secretHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastSentAt: now,
        sendWindowStart: sameWindow ? state!.sendWindowStart! : now,
        sendsInWindow: attemptsInWindow + 1,
        attempts: 0,
        verifiedAt: null,
      }
      await tx.phoneVerification.upsert({ where: { userId: user.id }, create: { userId: user.id, ...record }, update: record })
      return 'reserved'
    })
    if (reservation === 'verified') return json({ verified: true, message: 'Number already verified.' })
    if (reservation === 'cooldown') return json({ message: 'Please wait at least a minute before requesting another code.' }, 429)
    if (reservation === 'limit') return json({ message: 'Daily SMS verification limit reached. Try again tomorrow.' }, 429)
    try {
      const body: { recipients: string[]; message: string; deviceId?: string } = { recipients: [user.phoneNumber], message }
      if (process.env.TEXTBEE_DEVICE_ID?.trim()) body.deviceId = process.env.TEXTBEE_DEVICE_ID.trim()
      const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.TEXTBEE_API_KEY! },
        body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.data?.success === false) {
        // Do not leave an unusable code active after provider rejection.
        await prisma.phoneVerification.updateMany({ where: { userId: user.id, otpHash: secretHash }, data: { otpHash: null, expiresAt: null } })
        console.error('TEXTBEE SEND FAILED (HTTP status):', response.status)
        return json({ message: 'SMS gateway did not accept the message. Check the gateway phone, SIM and quota.' }, 502)
      }
      return json({ message: 'If your gateway is online, an SMS code has been queued. Enter the code when it arrives.', sent: true })
    } catch {
      await prisma.phoneVerification.updateMany({ where: { userId: user.id, otpHash: secretHash }, data: { otpHash: null, expiresAt: null } })
      return json({ message: 'SMS gateway is unreachable. Please try later.' }, 502)
    }
  }

  if (action === 'verify') {
    const code = typeof data?.code === 'string' ? data.code.trim() : ''
    if (!/^\d{6}$/.test(code)) return json({ message: 'Enter a six-digit SMS code.' }, 400)
    if (!current || current.phoneNumber !== user.phoneNumber || !current.otpHash ||
        !current.expiresAt || current.expiresAt.getTime() < Date.now()) {
      return json({ message: 'Code expired or missing. Request a new SMS code.' }, 400)
    }
    if (current.attempts >= MAX_ATTEMPTS) return json({ message: 'Too many incorrect codes. Request a new code.' }, 429)
    // Count the attempt atomically; no one gets an unlimited guessing window.
    const attempt = await prisma.phoneVerification.updateMany({
      where: { userId: user.id, phoneNumber: user.phoneNumber, otpHash: current.otpHash, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    })
    if (attempt.count !== 1) return json({ message: 'Please request a new code.' }, 409)
    if (!equalHash(current.otpHash, otpHash(user.id, user.phoneNumber, code))) return json({ message: 'Incorrect code.' }, 401)
    const verified = await prisma.phoneVerification.updateMany({
      where: { userId: user.id, phoneNumber: user.phoneNumber, otpHash: current.otpHash, verifiedAt: null },
      data: { otpHash: null, expiresAt: null, verifiedAt: new Date() },
    })
    if (verified.count !== 1) return json({ message: 'Verification already processed. Refresh your profile.' }, 409)
    return json({ verified: true, message: 'Mobile number verified by SMS.' })
  }
  return json({ message: 'Invalid operation.' }, 400)
}
