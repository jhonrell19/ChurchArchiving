import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function upsertStaff(
  email: string,
  password: string,
  role: 'ADMIN' | 'BURIAL_ADMIN',
  firstName: string,
  surname: string
) {
  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      surname,
      password: hashedPassword,
      role,
      emailVerified: true,
    },
    create: {
      firstName,
      surname,
      email,
      password: hashedPassword,
      role,
      emailVerified: true,
    },
  })
}

async function main() {
  await upsertStaff(
    'admin@ifimaragondon.com',
    'Admin12345',
    'ADMIN',
    'Main',
    'Administrator'
  )

  await upsertStaff(
    'burial@ifimaragondon.com',
    'Burial12345',
    'BURIAL_ADMIN',
    'Burial',
    'Administrator'
  )

  console.log('Development staff accounts are ready.')
  console.log('IMPORTANT: change these passwords before production deployment.')
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
