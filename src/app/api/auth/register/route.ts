import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

import { createEmailVerificationToken } from '@/lib/accountTokens'
import {
  appBaseUrl,
  sendTransactionalEmail,
} from '@/lib/email'
import { prisma } from '@/lib/prisma'
import {
  EMAIL_RE,
  NAME_RE,
  PH_PHONE_RE,
  cleanName,
  normalizeEmail,
  normalizePhone,
  validatePassword,
} from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const firstName = cleanName(body?.firstName)
    const middleName = cleanName(body?.middleName)
    const surname = cleanName(body?.surname)
    const phoneNumber = normalizePhone(body?.phoneNumber)
    const address =
      typeof body?.address === 'string'
        ? body.address.trim().replace(/\s+/g, ' ')
        : ''
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
      !phoneNumber ||
      !address ||
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

    if (!PH_PHONE_RE.test(phoneNumber)) {
      return NextResponse.json(
        {
          message:
            'Use a valid Philippine mobile number such as 09XXXXXXXXX.',
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

    if (address.length < 8 || address.length > 500) {
      return NextResponse.json(
        { message: 'Please enter a complete address.' },
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
        address,
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
      html: `<p>Hello ${firstName},</p><p>Please verify your Smart Parish email address by clicking the link below:</p><p><a href="${verifyUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
    })

    return NextResponse.json(
      {
        message: mail.sent
          ? 'Account created. Check your email to verify your account.'
          : 'Account created. Email delivery is not configured, so use the development verification link below.',
        verificationRequired: true,
        developmentVerificationUrl:
          process.env.NODE_ENV === 'production'
            ? undefined
            : verifyUrl,
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
