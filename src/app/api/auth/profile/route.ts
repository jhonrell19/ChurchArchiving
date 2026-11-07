import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateAndFormatAddress } from '@/lib/address'
import { validateInternationalPhone } from '@/lib/validation'
import { lookupPhoneLineStatus, isConfirmedInactive, phoneLineStatusExplanation } from '@/lib/phoneLineStatus'

/** Update optional parishioner contact information. Admin identities are not editable here. */
export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ message: 'Please sign in.' }, { status: 401 })
    }
    if (currentUser.role !== 'USER') {
      return NextResponse.json({ message: 'Not allowed.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ message: 'Invalid request.' }, { status: 400 })
    }

    const updates: { phoneNumber?: string | null; address?: string | null } = {}
    let phoneStatusNote: string | undefined
    if (Object.prototype.hasOwnProperty.call(body, 'phoneNumber')) {
      if (typeof body.phoneNumber !== 'string') {
        return NextResponse.json({ message: 'Invalid phone number.' }, { status: 400 })
      }
      const rawPhone = body.phoneNumber.trim()
      if (rawPhone) {
        const number = validateInternationalPhone(rawPhone, body.phoneCountry)
        if (!number) {
          return NextResponse.json(
            { message: 'Enter a valid phone number for the selected country.' },
            { status: 400 }
          )
        }
        const check = await lookupPhoneLineStatus(number)
        if (isConfirmedInactive(check)) {
          return NextResponse.json({ message: 'Carrier reports the number is inactive or unassigned.' }, { status: 400 })
        }
        phoneStatusNote = phoneLineStatusExplanation(check)
        updates.phoneNumber = number
      } else {
        updates.phoneNumber = null
      }
    }

    if (body.clearAddress === true) {
      updates.address = null
    } else if (Object.prototype.hasOwnProperty.call(body, 'addressInfo')) {
      const address = validateAndFormatAddress(body.addressInfo)
      if (!address) {
        return NextResponse.json(
          { message: 'Complete the location fields, or leave your existing address unchanged.' },
          { status: 400 }
        )
      }
      updates.address = address
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'Nothing to update.' }, { status: 400 })
    }

    const saved = await prisma.user.update({
      where: { id: currentUser.id },
      data: updates,
      select: { phoneNumber: true, address: true },
    })
    return NextResponse.json(
      { message: 'Contact information updated.', ...saved, phoneStatusNote },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('UPDATE CONTACT ERROR:', error)
    return NextResponse.json({ message: 'Unable to update contact details.' }, { status: 500 })
  }
}
