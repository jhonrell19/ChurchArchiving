/**
 * Explicit, create-only staff seeding. NEVER reset an existing staff password
 * simply by rerunning a seed script or deploying a new version.
 *
 * To create missing development staff users once, set:
 *   SMART_PARISH_ENABLE_STAFF_SEED=yes
 *   SEED_MAIN_ADMIN_EMAIL / SEED_MAIN_ADMIN_PASSWORD
 *   SEED_BURIAL_ADMIN_EMAIL / SEED_BURIAL_ADMIN_PASSWORD
 * Do not commit these passwords, even to private repositories.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

type StaffRole = 'ADMIN' | 'BURIAL_ADMIN'
async function createMissingStaff(emailEnv: string, passwordEnv: string, role: StaffRole, firstName: string) {
  const email = (process.env[emailEnv] || '').trim().toLowerCase()
  const password = process.env[passwordEnv] || ''
  if (!email || password.length < 16) {
    throw new Error(`Set ${emailEnv} and a strong ${passwordEnv} (16+ characters) before seeding.`)
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    console.log(`${role} account already exists; credentials are unchanged.`)
    return
  }
  await prisma.user.create({
    data: {
      firstName, surname: 'Administrator', email,
      password: await bcrypt.hash(password, 12),
      role, emailVerified: true,
    },
  })
  console.log(`${role} account created; password not printed.`)
}

async function main() {
  if (process.env.SMART_PARISH_ENABLE_STAFF_SEED !== 'yes') {
    console.log('Staff seed skipped; set SMART_PARISH_ENABLE_STAFF_SEED=yes to create missing staff accounts explicitly.')
    return
  }
  await createMissingStaff('SEED_MAIN_ADMIN_EMAIL', 'SEED_MAIN_ADMIN_PASSWORD', 'ADMIN', 'Main')
  await createMissingStaff('SEED_BURIAL_ADMIN_EMAIL', 'SEED_BURIAL_ADMIN_PASSWORD', 'BURIAL_ADMIN', 'Burial')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Staff seed failed.')
  process.exitCode = 1
}).finally(async () => { await prisma.$disconnect() })
