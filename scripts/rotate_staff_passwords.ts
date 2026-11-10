/**
 * Rotate ONLY existing ADMIN and BURIAL_ADMIN credentials in one transaction.
 * All secrets are supplied through temporary process environment variables.
 * Never creates staff accounts and never reveals passwords or hashes.
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

const forbidden = ['Admin12345', 'Burial12345', 'Password123!']

function emailFromEnv(key: string): string {
  const value = (process.env[key] || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${key} must be an existing staff login email.`)
  }
  return value
}

function passwordFromEnv(key: string): string {
  const value = process.env[key] || ''
  if (value.length < 16 || value.length > 128 || !/[A-Z]/.test(value) ||
      !/[a-z]/.test(value) || !/\d/.test(value) || !/[^a-zA-Z0-9]/.test(value)) {
    throw new Error(`${key} must be 16–128 characters with upper/lowercase, a number and a symbol.`)
  }
  if (forbidden.includes(value)) throw new Error(`${key} cannot use a demonstration password.`)
  return value
}

async function main() {
  if (process.env.STAFF_PASSWORD_ROTATION !== 'YES') {
    throw new Error('Set STAFF_PASSWORD_ROTATION=YES to authorize rotation.')
  }
  const mainEmail = emailFromEnv('MAIN_ADMIN_EMAIL')
  const burialEmail = emailFromEnv('BURIAL_ADMIN_EMAIL')
  if (mainEmail === burialEmail) throw new Error('The staff emails must be different.')

  const mainPassword = passwordFromEnv('MAIN_ADMIN_PASSWORD')
  const burialPassword = passwordFromEnv('BURIAL_ADMIN_PASSWORD')
  if (mainPassword === burialPassword) throw new Error('Staff passwords must be different.')

  // Fail closed if an email is mistyped or belongs to the wrong account.
  const [mainUser, burialUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: mainEmail }, select: { id: true, role: true } }),
    prisma.user.findUnique({ where: { email: burialEmail }, select: { id: true, role: true } }),
  ])
  if (!mainUser || mainUser.role !== 'ADMIN') {
    throw new Error('Main Admin email does not match an existing ADMIN account. No changes made.')
  }
  if (!burialUser || burialUser.role !== 'BURIAL_ADMIN') {
    throw new Error('Burial Admin email does not match an existing BURIAL_ADMIN account. No changes made.')
  }

  const [mainHash, burialHash] = await Promise.all([
    bcrypt.hash(mainPassword, 12),
    bcrypt.hash(burialPassword, 12),
  ])

  await prisma.$transaction(async tx => {
    const main = await tx.user.update({
      where: { id: mainUser.id, role: 'ADMIN' },
      data: { password: mainHash },
    })
    const burial = await tx.user.update({
      where: { id: burialUser.id, role: 'BURIAL_ADMIN' },
      data: { password: burialHash },
    })
    await tx.session.deleteMany({ where: { userId: { in: [main.id, burial.id] } } })
    await tx.passwordResetToken.deleteMany({ where: { userId: { in: [main.id, burial.id] } } })
  })
  console.log('PASS: both existing staff passwords rotated; both accounts\' sessions and reset tokens revoked.')
  console.log('NEXT: verify each staff login privately. Admin MFA is still required before public rollout.')
}

main().catch(error => {
  console.error('STOP: staff rotation was not completed:', error.message)
  process.exitCode = 1
}).finally(async () => { await prisma.$disconnect() })
