import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { hashAccountToken } from '@/lib/accountTokens'
import { validatePassword } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!token || !newPassword) {
      return NextResponse.json({ message: 'Token and new password are required.' }, { status: 400 })
    }

    const passwordErrors = validatePassword(newPassword)
    if (passwordErrors.length) {
      return NextResponse.json(
        { message: `Password must contain ${passwordErrors.join(', ')}.` },
        { status: 400 }
      )
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashAccountToken(token) },
    })

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      if (record) await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined)
      return NextResponse.json({ message: 'Reset link is invalid or expired.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ])

    return NextResponse.json({ message: 'Password reset successfully.' })
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error)
    return NextResponse.json({ message: 'Unable to reset password.' }, { status: 500 })
  }
}
