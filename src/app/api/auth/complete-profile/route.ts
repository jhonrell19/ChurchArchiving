import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  NAME_RE,
  PH_PHONE_RE,
  cleanName,
  normalizePhone,
} from '@/lib/validation'

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Please sign in again.' },
        { status: 401 }
      )
    }

    if (currentUser.role !== 'USER') {
      return NextResponse.json(
        { message: 'This page is only for parishioner accounts.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)

    const firstName = cleanName(body?.firstName)
    const middleName = cleanName(body?.middleName)
    const surname = cleanName(body?.surname)
    const phoneNumber = normalizePhone(body?.phoneNumber)
    const address =
      typeof body?.address === 'string'
        ? body.address.trim().replace(/\s+/g, ' ')
        : ''

    if (!firstName || !surname || !phoneNumber || !address) {
      return NextResponse.json(
        { message: 'Please complete all required fields.' },
        { status: 400 }
      )
    }

    if (
      !NAME_RE.test(firstName) ||
      !NAME_RE.test(surname) ||
      (middleName && !NAME_RE.test(middleName))
    ) {
      return NextResponse.json(
        { message: 'Please enter valid name fields.' },
        { status: 400 }
      )
    }

    if (!PH_PHONE_RE.test(phoneNumber)) {
      return NextResponse.json(
        {
          message:
            'Use a valid Philippine mobile number such as 09XXXXXXXXX.',
        },
        { status: 400 }
      )
    }

    if (address.length < 8 || address.length > 500) {
      return NextResponse.json(
        { message: 'Please enter a complete address.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        firstName,
        middleName: middleName || null,
        surname,
        phoneNumber,
        address,
      },
    })

    return NextResponse.json(
      {
        message: 'Profile completed successfully.',
        profileComplete: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          middleName: user.middleName,
          surname: user.surname,
          phoneNumber: user.phoneNumber,
          address: user.address,
          email: user.email,
          role: user.role,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('COMPLETE PROFILE ERROR:', error)

    return NextResponse.json(
      { message: 'Unable to complete your profile right now.' },
      { status: 500 }
    )
  }
}
