import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { createEmailVerificationToken } from '@/lib/accountTokens'
import {
  appBaseUrl,
  sendTransactionalEmail,
  isTransactionalEmailConfigured,
} from '@/lib/email'
import { prisma } from '@/lib/prisma'
import {
  EMAIL_RE,
  NAME_RE,
  cleanName,
  normalizeEmail,
  validateInternationalPhone,
  validatePassword,
} from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const firstName = cleanName(body?.firstName)
    const middleName = cleanName(body?.middleName)
    const surname = cleanName(body?.surname)
    const rawPhone = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
    // Registration accepts optional Philippine mobile numbers only.
    // Normalize accepted numbers to E.164 for storage and future SMS integrations.
    const phoneNumber = rawPhone && /^09\d{9}$/.test(rawPhone)
      ? validateInternationalPhone(rawPhone, 'PH')
      : null
    const email = normalizeEmail(body?.email)
    const password =
      typeof body?.password === 'string'
        ? body.password
        : ''
    const confirmPassword =
      typeof body?.confirmPassword === 'string'
        ? body.confirmPassword
        : ''

    if (
      !firstName ||
      !surname ||
      !email ||
      !password ||
      !confirmPassword
    ) {
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
            'Enter an 11-digit Philippine mobile number starting with 09, or leave it blank. Format does not prove ownership.',
        },
        { status: 400 }
      )
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match.' },
        { status: 400 }
      )
    }

    const passwordErrors = validatePassword(password)

    if (passwordErrors.length) {
      return NextResponse.json(
        {
          message: `Password must contain ${passwordErrors.join(', ')}.`,
        },
        { status: 400 }
      )
    }

    // No public development verification URL: require a real mail provider
    // before creating an account that cannot be activated by the owner.
    if (!isTransactionalEmailConfigured()) {
      return NextResponse.json(
        { message: 'Email verification is temporarily unavailable. Please contact the parish office.' },
        { status: 503 }
      )
    }

    const existingEmailUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingEmailUser) {
      return NextResponse.json(
        { message: 'Email is already registered.' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        firstName,
        middleName: middleName || null,
        surname,
        phoneNumber,
        address: null,
        email,
        password: hashedPassword,
        role: 'USER',
        emailVerified: false,
      },
    })

    const emailToken = await createEmailVerificationToken(user.id)
    const verifyUrl = `${appBaseUrl(
      req.url
    )}/verify-email?token=${encodeURIComponent(emailToken)}`

    const mail = await sendTransactionalEmail({
      to: user.email,
      subject: 'Verify your Smart Parish account',
      // Do not interpolate user-entered names into an email HTML template.
      html: `<p>Welcome to Smart Parish.</p><p>To verify your email address, use the secure link below:</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not register, ignore this message.</p>`,
    })

    return NextResponse.json(
      {
        message: mail.sent
          ? 'Account created. Check your inbox and spam folder for your verification email.'
          : 'Account created but the email could not be delivered. Please use Resend Verification later or contact the parish office.',
        verificationRequired: true,
        phoneLineStatus: 'not_checked',
        phoneStatusNote: phoneNumber ? 'Phone format checked. After verifying your email and signing in, you can verify your mobile number by SMS in your profile.' : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { message: 'Email is already registered.' },
        { status: 409 }
      )
    }

    console.error('REGISTER ERROR:', error)

    return NextResponse.json(
      { message: 'Unable to create account.' },
      { status: 500 }
    )
  }
}
