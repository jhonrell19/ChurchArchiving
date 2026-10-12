import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashAccountToken } from '@/lib/accountTokens'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    if (!token) return NextResponse.json({ message: 'Verification token is missing.' }, { status: 400 })

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashAccountToken(token) },
      include: { user: true },
    })

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      if (record) await prisma.emailVerificationToken.delete({ where: { id: record.id } }).catch(() => undefined)
      return NextResponse.json({ message: 'Verification link is invalid or expired.' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
    ])

    return NextResponse.json({ message: 'Email verified successfully. You can now sign in.' })
  } catch (error) {
    console.error('VERIFY EMAIL ERROR:', error)
    return NextResponse.json({ message: 'Unable to verify email.' }, { status: 500 })
  }
}
