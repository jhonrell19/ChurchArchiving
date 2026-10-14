import { NextResponse } from 'next/server'

import {
  getCurrentUser,
  isUserProfileComplete,
} from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { message: 'Please log in again.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    const fullName = [
      user.firstName,
      user.middleName,
      user.surname,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    return NextResponse.json(
      {
        user: {
          id: user.id,
          firstName: user.firstName,
          middleName: user.middleName,
          surname: user.surname,
          phoneNumber: user.phoneNumber,
          address: user.address,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          fullName: fullName || user.email,
        },
        profileComplete:
          user.role === 'USER'
            ? isUserProfileComplete(user)
            : true,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('PROFILE ERROR:', error)

    return NextResponse.json(
      {
        message: 'Unable to load profile information.',
      },
      { status: 500 }
    )
  }
}
