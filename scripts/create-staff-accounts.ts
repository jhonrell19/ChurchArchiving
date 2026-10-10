import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

async function main() {

  // ==============================
  // MAIN ADMIN
  // ==============================

  const adminPassword =
    await bcrypt.hash(
      'Admin12345',
      12
    )

  const admin =
    await prisma.user.upsert({

      where: {
        email:
          'admin@ifimaragondon.com',
      },

      update: {
        password: adminPassword,
        role: 'ADMIN',
      },

      create: {
        firstName: 'Main',
        middleName: null,
        surname: 'Administrator',

        phoneNumber: null,
        address: null,

        email:
          'admin@ifimaragondon.com',

        password: adminPassword,

        role: 'ADMIN',
      },

    })


  // ==============================
  // BURIAL ADMIN
  // ==============================

  const burialPassword =
    await bcrypt.hash(
      'Burial12345',
      12
    )

  const burialAdmin =
    await prisma.user.upsert({

      where: {
        email:
          'burial@ifimaragondon.com',
      },

      update: {
        password: burialPassword,
        role: 'BURIAL_ADMIN',
      },

      create: {
        firstName: 'Burial',
        middleName: null,
        surname: 'Administrator',

        phoneNumber: null,
        address: null,

        email:
          'burial@ifimaragondon.com',

        password: burialPassword,

        role: 'BURIAL_ADMIN',
      },

    })


  console.log('')
  console.log(
    '=============================='
  )

  console.log(
    'STAFF ACCOUNTS CREATED'
  )

  console.log(
    '=============================='
  )

  console.log('')

  console.log('MAIN ADMIN')
  console.log(
    'Email: admin@ifimaragondon.com'
  )
  console.log(
    'Password: Admin12345'
  )
  console.log(
    'Role:',
    admin.role
  )

  console.log('')

  console.log('BURIAL ADMIN')
  console.log(
    'Email: burial@ifimaragondon.com'
  )
  console.log(
    'Password: Burial12345'
  )
  console.log(
    'Role:',
    burialAdmin.role
  )

  console.log('')
}


main()
  .catch((error) => {

    console.error(error)

    process.exit(1)

  })
  .finally(async () => {

    await prisma.$disconnect()

  })