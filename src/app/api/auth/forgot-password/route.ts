import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/accountTokens'
import { appBaseUrl, sendTransactionalEmail, isTransactionalEmailConfigured } from '@/lib/email'
import { normalizeEmail } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    if (!email) return NextResponse.json({ message: 'Email is required.' }, { status: 400 })
    if (!isTransactionalEmailConfigured()) {
      return NextResponse.json({ message: 'Email recovery is temporarily unavailable.' }, { status: 503 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ message: 'If that account exists, a password reset link has been prepared.' })
    }

    const previous = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
    })
    if (previous && Date.now() - previous.createdAt.getTime() < 60_000) {
      return NextResponse.json({ message: 'If that account exists, please check your email.' })
    }
    const token = await createPasswordResetToken(user.id)
    const resetUrl = `${appBaseUrl(req.url)}/reset-password?token=${encodeURIComponent(token)}`
    const mail = await sendTransactionalEmail({
      to: user.email,
      subject: 'Reset your Smart Parish password',
      html: `<p>A password reset was requested for your Smart Parish account.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you did not request it, ignore this email.</p>`,
    })

    return NextResponse.json({
      message: mail.sent
        ? 'If that account exists, please check your email.'
        : 'Email recovery is temporarily unavailable. Try again later.',
    })
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error)
    return NextResponse.json({ message: 'Unable to start password recovery.' }, { status: 500 })
  }
}
