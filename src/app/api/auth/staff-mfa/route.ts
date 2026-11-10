import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { createSession, SESSION_COOKIE, STAFF_SESSION_MAX_AGE_SECONDS } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  MFA_PENDING_COOKIE, createRecoveryCodes, decryptMfaSecret, encryptMfaSecret,
  findValidStaffChallenge, generateTotpSecret, hashMfaRecoveryCode,
  isRecoveryCode, matchingTotpStep, normalizeRecoveryCode,
} from '@/lib/staffMfa'

const headers = { 'Cache-Control': 'no-store' }
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers })

async function pending() {
  const jar = await cookies()
  return findValidStaffChallenge(jar.get(MFA_PENDING_COOKIE)?.value)
}

export async function GET() {
  const challenge = await pending()
  if (!challenge) return json({ message: 'Your staff sign-in expired. Enter your password again.' }, 401)
  const staffMfa = await prisma.staffMfa.findUnique({ where: { userId: challenge.userId } })
  return json({ enrolled: Boolean(staffMfa), role: challenge.user.role })
}

export async function POST(req: Request) {
  const challenge = await pending()
  if (!challenge) return json({ message: 'Your staff sign-in expired. Enter your password again.' }, 401)
  const data = await req.json().catch(() => null)
  const action = typeof data?.action === 'string' ? data.action : ''
  const enrolled = await prisma.staffMfa.findUnique({ where: { userId: challenge.userId } })

  if (action === 'setup') {
    if (enrolled) return json({ message: 'Authenticator already enrolled.' }, 409)
    const secret = challenge.setupSecretEncrypted
      ? decryptMfaSecret(challenge.setupSecretEncrypted)
      : generateTotpSecret()
    if (!challenge.setupSecretEncrypted) {
      await prisma.staffMfaChallenge.update({
        where: { id: challenge.id }, data: { setupSecretEncrypted: encryptMfaSecret(secret) },
      })
    }
    const uri = `otpauth://totp/${encodeURIComponent('Smart Parish:' + challenge.user.email)}?secret=${secret}&issuer=${encodeURIComponent('Smart Parish')}&algorithm=SHA1&digits=6&period=30`
    return json({ secret, uri })
  }

  if (action !== 'verify') return json({ message: 'Invalid MFA operation.' }, 400)
  const code = typeof data?.code === 'string' ? data.code.trim() : ''
  if (!/^\d{6}$/.test(code) && !isRecoveryCode(code)) return json({ message: 'Enter your six-digit code or a recovery code.' }, 400)
  // Count each submitted code BEFORE verifying it. A pending password session has only five tries.
  const counted = await prisma.staffMfaChallenge.updateMany({
    where: { id: challenge.id, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } },
  })
  if (counted.count !== 1) return json({ message: 'Too many attempts; sign in again.' }, 429)

  let recoveryCodes: string[] | undefined
  if (enrolled) {
    if (isRecoveryCode(code)) {
      const hashes = JSON.parse(enrolled.recoveryCodesJson) as string[]
      const hash = hashMfaRecoveryCode(normalizeRecoveryCode(code))
      if (!hashes.includes(hash)) return json({ message: 'Incorrect or used recovery code.' }, 401)
      const modified = await prisma.staffMfa.updateMany({
        where: { userId: challenge.userId, recoveryCodesJson: enrolled.recoveryCodesJson },
        data: { recoveryCodesJson: JSON.stringify(hashes.filter(h => h !== hash)) },
      })
      if (modified.count !== 1) return json({ message: 'Please retry your sign-in.' }, 409)
    } else {
      const secret = decryptMfaSecret(enrolled.secretEncrypted)
      const step = matchingTotpStep(secret, code, enrolled.lastUsedStep)
      if (step === null) return json({ message: 'Incorrect or already used authenticator code.' }, 401)
      const modified = await prisma.staffMfa.updateMany({
        where: { userId: challenge.userId, lastUsedStep: { lt: step } },
        data: { lastUsedStep: step },
      })
      if (modified.count !== 1) return json({ message: 'Code already used; wait for the next code.' }, 409)
    }
  } else {
    if (!challenge.setupSecretEncrypted || isRecoveryCode(code)) return json({ message: 'Set up your authenticator app first.' }, 400)
    const secret = decryptMfaSecret(challenge.setupSecretEncrypted)
    const step = matchingTotpStep(secret, code)
    if (step === null) return json({ message: 'Incorrect authenticator code.' }, 401)
    recoveryCodes = createRecoveryCodes()
    await prisma.staffMfa.create({
      data: {
        userId: challenge.userId,
        secretEncrypted: encryptMfaSecret(secret),
        recoveryCodesJson: JSON.stringify(recoveryCodes.map(hashMfaRecoveryCode)),
        lastUsedStep: step,
      },
    })
  }

  // A normal staff session exists ONLY after successful second-factor verification.
  const session = await createSession(challenge.userId, true)
  await prisma.staffMfaChallenge.deleteMany({ where: { userId: challenge.userId } })
  const response = json({ message: 'Staff authentication successful.', role: challenge.user.role, recoveryCodes })
  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: STAFF_SESSION_MAX_AGE_SECONDS })
  response.cookies.set(MFA_PENDING_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
