import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { createPasswordResetToken } from '@/lib/accountTokens'
import { appBaseUrl, isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email'
import { EMAIL_RE, normalizeEmail } from '@/lib/validation'

const respond = (value: object, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

async function supervisor() {
  const actor = await getCurrentUser()
  return isSupervisor(actor) ? actor : null
}

// Staff records only; this API never lists passwords, MFA secrets, recovery
// codes, session tokens or parishioner identity evidence.
export async function GET() {
  const actor = await supervisor()
  if (!actor) return respond({ message: 'Forbidden' }, 403)
  const users = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'BURIAL_ADMIN'] } },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true, email: true, firstName: true, surname: true, role: true,
      emailVerified: true, accountEnabled: true, createdAt: true },
  })
  return respond({ staff: users })
}

// Invite by email; no administrator ever sees or chooses a staff password.
// A one-use password setup link proves control of the inbox, and staff MFA
// remains mandatory before a session can be issued.
export async function POST(req: NextRequest) {
  const actor = await supervisor()
  if (!actor) return respond({ message: 'Forbidden' }, 403)
  if (!isTransactionalEmailConfigured()) return respond({ message: 'Configure Resend before inviting staff.' }, 503)

  const data = await req.json().catch(() => null)
  const email = normalizeEmail(data?.email)
  const firstName = typeof data?.firstName === 'string' ? data.firstName.trim() : ''
  const surname = typeof data?.surname === 'string' ? data.surname.trim() : ''
  if (!email || !EMAIL_RE.test(email) || !firstName || firstName.length > 100 ||
      !surname || surname.length > 100) {
    return respond({ message: 'Enter a valid email, first name, and surname.' }, 400)
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return respond({ message: 'This email already has an account. Contact the system supervisor to review it.' }, 409)
  }

  let userId: number | null = null
  try {
    const password = await bcrypt.hash(randomBytes(48).toString('hex'), 12)
    const user = await prisma.user.create({
      data: { email, firstName, surname, password, role: 'STAFF',
        emailVerified: false, membershipStatus: 'approved', accountEnabled: true },
      select: { id: true, email: true },
    })
    userId = user.id
    const token = await createPasswordResetToken(user.id)
    const inviteUrl = `${appBaseUrl(req.url)}/reset-password?token=${encodeURIComponent(token)}`
    const mail = await sendTransactionalEmail({
      to: user.email,
      subject: 'Smart Parish — Church Staff account invitation',
      html: `<p>A parish supervisor invited this address to be a Church Staff account.</p><p><a href="${inviteUrl}">Set your staff password</a></p><p>The link expires in one hour. After password setup, sign in and enroll an authenticator. If you did not expect this invitation, ignore it and contact the parish office.</p>`,
    })
    if (!mail.sent) throw new Error('email delivery failed')
    await prisma.$executeRaw`INSERT INTO parish_private.audit_log ("user", action, created_at)
      VALUES (${actor.email}, ${'Staff invitation created for user #' + user.id}, now())`
    return respond({ created: true })
  } catch (error) {
    // Do not leave an unverified, unusable invited account after a failed send.
    // Password setup tokens cascade with its User row.
    if (userId) {
      // On an audit failure *after sending*, preserve the account so the sent
      // invitation does not become a broken link.
      console.error('Staff invitation needs administrative reconciliation', { userId })
      return respond({ message: 'Staff invitation was created but audit confirmation failed. Verify the staff list before retrying.' }, 503)
    }
    console.error('Staff invitation failed')
    return respond({ message: 'Unable to create the invitation. Check Resend configuration.' }, 503)
  }
}

// Deactivation revokes sessions and pending MFA challenges in one transaction.
// Activating again does NOT bypass email verification or MFA.
export async function PATCH(req: NextRequest) {
  const actor = await supervisor()
  if (!actor) return respond({ message: 'Forbidden' }, 403)
  const body = await req.json().catch(() => null)
  const userId = Number(body?.userId)
  const enabled = body?.accountEnabled
  if (!Number.isSafeInteger(userId) || userId <= 0 || typeof enabled !== 'boolean' || userId === actor.id) {
    return respond({ message: 'Invalid staff account or action.' }, 400)
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({
        where: { id: userId, role: { in: ['STAFF', 'BURIAL_ADMIN'] } },
        data: { accountEnabled: enabled },
      })
      if (updated.count !== 1) return 0
      await tx.session.deleteMany({ where: { userId } })
      await tx.staffMfaChallenge.deleteMany({ where: { userId } })
      await tx.$executeRaw`INSERT INTO parish_private.audit_log ("user", action, created_at)
        VALUES (${actor.email}, ${(enabled ? 'Enabled' : 'Disabled') + ' staff account #' + userId}, now())`
      return updated.count
    })
    if (!result) return respond({ message: 'Staff account not found.' }, 404)
    return respond({ updated: true })
  } catch {
    console.error('Staff status update failed')
    return respond({ message: 'Could not update staff account. Nothing was committed.' }, 503)
  }
}
