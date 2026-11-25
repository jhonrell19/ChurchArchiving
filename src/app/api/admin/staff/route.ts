import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { createPasswordResetToken } from '@/lib/accountTokens'
import { appBaseUrl, isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email'
import { EMAIL_RE, normalizeEmail, validatePassword } from '@/lib/validation'

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

// Invite by email so the staff member can set their initial password.
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
  let mailSent = false
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
    mailSent = true
    await prisma.$executeRaw`INSERT INTO parish_private.audit_log ("user", action, created_at)
      VALUES (${actor.email}, ${'Staff invitation created for user #' + user.id}, now())`
    return respond({ created: true })
  } catch (error) {
    // If delivery fails, remove the unusable invited account and its tokens.
    // After a successful send, keep it so the invitation link remains valid.
    if (userId && !mailSent) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
    }
    if (userId && mailSent) {
      console.error('Staff invitation needs audit reconciliation', { userId })
      return respond({ message: 'Invitation sent, but audit confirmation failed. Verify the staff list before retrying.' }, 503)
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
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId === actor.id) {
    return respond({ message: 'Invalid staff account.' }, 400)
  }

  const passwordChange = body.action === 'password'
  const nameChange = body.action === 'name'
  const enabled = body.accountEnabled
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const surname = typeof body.surname === 'string' ? body.surname.trim() : ''
  if (nameChange && (!firstName || !surname || firstName.length > 100 || surname.length > 100)) {
    return respond({ message: 'Enter a first name and surname of up to 100 characters each.' }, 400)
  }
  if (passwordChange) {
    if (typeof body.password !== 'string' || Buffer.byteLength(body.password) > 72) {
      return respond({ message: 'Enter a password of up to 72 bytes.' }, 400)
    }
    const errors = validatePassword(body.password)
    if (errors.length) return respond({ message: 'Password must contain ' + errors.join(', ') + '.' }, 400)
  }
  if (!nameChange && !passwordChange && (body.action !== undefined || typeof enabled !== 'boolean')) {
    return respond({ message: 'Invalid staff action.' }, 400)
  }
  try {
    const data = passwordChange ? { password: await bcrypt.hash(body.password, 12) }
      : nameChange ? { firstName, surname } : { accountEnabled: enabled }
    const action = passwordChange ? 'Changed password for' : nameChange ? 'Renamed' : enabled ? 'Enabled' : 'Disabled'
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({
        where: { id: userId, role: { in: ['STAFF', 'BURIAL_ADMIN'] }, ...(passwordChange && { emailVerified: true }) },
        data,
      })
      if (updated.count !== 1) return 0
      if (!nameChange) {
        await tx.session.deleteMany({ where: { userId } })
        await tx.staffMfaChallenge.deleteMany({ where: { userId } })
      }
      if (passwordChange) await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.$executeRaw`INSERT INTO parish_private.audit_log ("user", action, created_at)
        VALUES (${actor.email}, ${action + ' staff account #' + userId}, now())`
      return updated.count
    })
    if (!result) return respond({ message: 'Staff account not found.' }, 404)
    return respond({ updated: true })
  } catch {
    console.error('Staff status update failed')
    return respond({ message: 'Could not update staff account. Nothing was committed.' }, 503)
  }
}
