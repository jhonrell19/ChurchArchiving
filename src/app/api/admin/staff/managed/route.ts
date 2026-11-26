import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { prisma } from '@/lib/prisma'
import { STAFF_PROVISIONED } from '@/lib/staffProvisioning'
import { EMAIL_RE, normalizeEmail, validatePassword } from '@/lib/validation'

const reply = (message: string, status: number) => NextResponse.json({ message }, { status })

export async function POST(req: Request) {
  const actor = await getCurrentUser()
  if (!actor || !isSupervisor(actor)) return reply('Forbidden', 403)
  const body = await req.json().catch(() => null)
  const action = body?.action
  if (!['create', 'credentials', 'resetMfa', 'delete'].includes(action)) return reply('Invalid action.', 400)
  const userId = body.userId
  if (action !== 'create' && (!Number.isSafeInteger(userId) || userId <= 0 || userId === actor.id))
    return reply('Invalid staff account.', 400)

  const email = normalizeEmail(body.email)
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const surname = typeof body.surname === 'string' ? body.surname.trim() : ''
  if (action === 'create' && (!firstName || !surname || firstName.length > 100 || surname.length > 100))
    return reply('Enter a first name and surname of up to 100 characters each.', 400)
  let password = ''
  if (action === 'create' || action === 'credentials') {
    if (!EMAIL_RE.test(email) || email.length > 254) return reply('Enter a valid staff login email.', 400)
    if (typeof body.password !== 'string' || Buffer.byteLength(body.password) > 72)
      return reply('Enter a password of up to 72 bytes.', 400)
    const errors = validatePassword(body.password)
    if (errors.length) return reply('Password must contain ' + errors.join(', ') + '.', 400)
    password = await bcrypt.hash(body.password, 12)
  }

  try {
    const changed = await prisma.$transaction(async tx => {
      let id = userId
      if (action === 'create') {
        const user = await tx.user.create({ data: { email, password, firstName, surname, role: 'STAFF',
          membershipStatus: STAFF_PROVISIONED, emailVerified: false } })
        id = user.id
      } else {
        const where = { id: userId, role: { in: ['STAFF', 'BURIAL_ADMIN'] as ('STAFF' | 'BURIAL_ADMIN')[] } }
        if (action === 'delete') {
          const result = await tx.user.deleteMany({ where: { ...where, accountEnabled: false } })
          if (!result.count) return false
        } else {
          const data = action === 'credentials'
            ? { role: 'STAFF' as const, email, password, emailVerified: false, membershipStatus: STAFF_PROVISIONED }
            : { updatedAt: new Date() }
          if (!(await tx.user.updateMany({ where, data })).count) return false
          await tx.session.deleteMany({ where: { userId } })
          await tx.staffMfaChallenge.deleteMany({ where: { userId } })
          await tx.passwordResetToken.deleteMany({ where: { userId } })
          await tx.emailVerificationToken.deleteMany({ where: { userId } })
          if (action === 'resetMfa') await tx.staffMfa.deleteMany({ where: { userId } })
        }
      }
      await tx.$executeRaw`INSERT INTO parish_private.audit_log ("user", action, created_at)
        VALUES (${actor.email}, ${'Staff management: ' + action + ' account #' + id}, now())`
      return true
    })
    if (!changed) return reply(action === 'delete' ? 'Disable this staff account before deleting it.' : 'Staff account unavailable.', 409)
    return reply('Staff account updated.', 200)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return reply('This email is already assigned. Choose another staff login.', 409)
    return reply('Could not save this change. Check the staff list and retry.', 503)
  }
}
