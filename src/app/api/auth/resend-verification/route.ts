import { supervisorProvisioned } from '@/lib/staffProvisioning'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmailVerificationToken } from '@/lib/accountTokens'
import { appBaseUrl, sendTransactionalEmail, isTransactionalEmailConfigured } from '@/lib/email'
import { normalizeEmail } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    if (!email) return NextResponse.json({ message: 'Email is required.' }, { status: 400 })
    if (!isTransactionalEmailConfigured()) {
      return NextResponse.json({ message: 'Email verification is temporarily unavailable.' }, { status: 503 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.emailVerified || supervisorProvisioned(user)) {
      return NextResponse.json({ message: 'If the account needs verification, a new link has been prepared.' })
    }

    // A persistent per-account cooldown works across server restarts and Node workers.
    const previous = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
    })
    if (previous && Date.now() - previous.createdAt.getTime() < 60_000) {
      return NextResponse.json({ message: 'Please wait one minute between verification email requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
    const token = await createEmailVerificationToken(user.id)
    const verifyUrl = `${appBaseUrl(req.url)}/verify-email?token=${encodeURIComponent(token)}`
    const mail = await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your Smart Parish account',
      html: `<p>Please verify your Smart Parish account:</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
    })

    if (!mail.sent) return NextResponse.json({ message: 'The email service could not confirm sending your verification link. Contact the parish administrator if this continues.' }, { status: 503 })
    return NextResponse.json({ message: 'Check the inbox or spam folder for the email address you entered.' })
  } catch (error) {
    console.error('RESEND VERIFICATION ERROR:', error)
    return NextResponse.json({ message: 'Unable to resend verification.' }, { status: 500 })
  }
}
