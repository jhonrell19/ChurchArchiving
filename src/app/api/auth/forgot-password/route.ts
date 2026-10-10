import { NextResponse } from 'next/server'

export async function POST() {
  // Email delivery is not configured yet. Do not generate reset tokens that are
  // returned directly to the browser in production.
  return NextResponse.json(
    {
      message:
        'Password reset by email is not configured yet. Please contact the parish office.',
    },
    { status: 503 }
  )
}
