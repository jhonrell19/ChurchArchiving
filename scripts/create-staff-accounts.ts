/** Secure interactive staff provisioning via environment variables.
 * Never run this script with shared/demo credentials; never print passwords.
 * Creation of an existing non-staff account is refused to avoid role escalation.
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

type StaffRole = 'ADMIN' | 'BURIAL_ADMIN'

async function provision(role: StaffRole, prefix: string) {
  const email = (process.env[`${prefix}_EMAIL`] || '').trim().toLowerCase()
  const password = process.env[`${prefix}_PASSWORD`] || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${prefix}_EMAIL is required`)
  if (password.length < 16 || password.length > 128 || !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    throw new Error(`${prefix}_PASSWORD must be 16–128 characters with upper/lowercase, a number and a symbol.`)
  }
  if (['Admin12345', 'Burial12345', 'Password123!'].includes(password)) {
    throw new Error('Refusing known demonstration password')
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.role !== role) {
    throw new Error(`Existing account with this email has a different role. Review manually.`)
  }
  if (existing && process.env.STAFF_PASSWORD_ROTATION !== 'YES') {
    throw new Error(`Staff account already exists. Set STAFF_PASSWORD_ROTATION=YES to rotate its credentials.`)
  }
  const passwordHash = await bcrypt.hash(password, 12)
  if (existing) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.id }, data: { password: passwordHash, emailVerified: true } }),
      prisma.session.deleteMany({ where: { userId: existing.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } }),
    ])
  } else {
    await prisma.user.create({ data: {
      firstName: role === 'ADMIN' ? 'Main' : 'Burial', surname: 'Administrator',
      email, password: passwordHash, role, emailVerified: true,
    } })
  }
  console.log(`Staff account ${role}: ${existing ? 'password rotated and sessions revoked' : 'created'}.`)
}

async function main() {
  const mainEmail = (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase()
  const burialEmail = (process.env.BURIAL_ADMIN_EMAIL || '').trim().toLowerCase()
  if (!mainEmail || mainEmail === burialEmail) throw new Error('Staff email addresses must be distinct.')
  // Validate BOTH credential sets before modifying either account.
  for (const prefix of ['MAIN_ADMIN', 'BURIAL_ADMIN']) {
    const password = process.env[`${prefix}_PASSWORD`] || ''
    if (password.length < 16 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
        !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      throw new Error(`${prefix}_PASSWORD is missing or too weak.`)
    }
  }
  if (process.env.MAIN_ADMIN_PASSWORD === process.env.BURIAL_ADMIN_PASSWORD) {
    throw new Error('Main and burial administrator passwords must be different.')
  }
  for (const [prefix, role] of [['MAIN_ADMIN','ADMIN'], ['BURIAL_ADMIN','BURIAL_ADMIN']] as const) {
    const email = (process.env[`${prefix}_EMAIL`] || '').trim().toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } })
    if (existing && existing.role !== role) throw new Error(`${prefix} email is registered with another role.`)
    if (existing && process.env.STAFF_PASSWORD_ROTATION !== 'YES') {
      throw new Error('An existing staff account requires STAFF_PASSWORD_ROTATION=YES.')
    }
  }
  await provision('ADMIN', 'MAIN_ADMIN')
  await provision('BURIAL_ADMIN', 'BURIAL_ADMIN')
}
main().catch(e => { console.error('Staff provisioning blocked:', e.message); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
