import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { lookupPhoneLineStatus, isConfirmedInactive } from '@/lib/phoneLineStatus'
import {
  NAME_RE,
  cleanName,
  validateInternationalPhone,
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
    const rawPhone = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
    const phoneNumber = rawPhone ? validateInternationalPhone(rawPhone, body?.phoneCountry) : null
    if (!firstName || !surname) {
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

    if (rawPhone && !phoneNumber) {
      return NextResponse.json(
        {
          message:
            'Enter a valid contact number for the selected country. This checks numbering rules, not ownership.',
        },
        { status: 400 }
      )
    }

    if (phoneNumber) {
      const check = await lookupPhoneLineStatus(phoneNumber)
      if (isConfirmedInactive(check)) {
        return NextResponse.json({ message: 'Carrier reports the number is inactive or unassigned. Correct it or leave it blank.' }, { status: 400 })
      }
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        firstName,
        middleName: middleName || null,
        surname,
        phoneNumber: phoneNumber ?? currentUser.phoneNumber,
        // Existing saved address stays unchanged; the user can edit it in their profile.
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
