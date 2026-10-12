import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmailVerificationToken } from '@/lib/accountTokens'
import { appBaseUrl, sendTransactionalEmail } from '@/lib/email'
import { normalizeEmail } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    if (!email) return NextResponse.json({ message: 'Email is required.' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: 'If the account needs verification, a new link has been prepared.' })
    }

    const token = await createEmailVerificationToken(user.id)
    const verifyUrl = `${appBaseUrl(req.url)}/verify-email?token=${encodeURIComponent(token)}`
    const mail = await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your Smart Parish account',
      html: `<p>Please verify your Smart Parish account:</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
    })

    return NextResponse.json({
      message: mail.sent ? 'Verification email sent.' : 'Email delivery is not configured. Use the development link.',
      developmentVerificationUrl: process.env.NODE_ENV === 'production' ? undefined : verifyUrl,
    })
  } catch (error) {
    console.error('RESEND VERIFICATION ERROR:', error)
    return NextResponse.json({ message: 'Unable to resend verification.' }, { status: 500 })
  }
}
