import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const {
      firstName,
      middleName,
      surname,
      phoneNumber,
      address,
      email,
      password,
      confirmPassword,
    } = await req.json()

    // Check required fields
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

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase()

    // Password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match.' },
        { status: 400 }
      )
    }

    // Basic password requirement
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must contain at least 8 characters.' },
        { status: 400 }
      )
    }

    // Check whether email already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email is already registered.' },
        { status: 409 }
      )
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 12)

    // IMPORTANT:
    // Public registration ALWAYS creates a normal USER.
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        surname: surname.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        email: normalizedEmail,
        password: hashedPassword,

        role: 'USER',
      },
    })

    return NextResponse.json(
      {
        message: 'Account created successfully.',
        user: {
          id: user.id,
          firstName: user.firstName,
          surname: user.surname,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('REGISTER ERROR:', error)

    return NextResponse.json(
      { message: 'Unable to create account.' },
      { status: 500 }
    )
  }
}