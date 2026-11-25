import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validatePassword } from '@/lib/validation'
import { loginAllowed, loginFailed, loginSucceeded } from '@/lib/loginThrottle'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (user?.role !== 'USER') return NextResponse.json({ message: 'Parishioner sign-in required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const { currentPassword, newPassword } = body || {}
  if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string')
    return NextResponse.json({ message: 'Enter both passwords.' }, { status: 400 })
  const errors = validatePassword(newPassword)
  if (errors.length || Buffer.byteLength(newPassword) > 72)
    return NextResponse.json({ message: errors.length ? 'Password needs ' + errors.join(', ') : 'Use at most 72 bytes.' }, { status: 400 })
  if (!loginAllowed(user.email)) return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 })
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
  if (!record || !await bcrypt.compare(currentPassword, record.password)) {
    loginFailed(user.email)
    return NextResponse.json({ message: 'Current password is incorrect.' }, { status: 400 })
  }
  if (await bcrypt.compare(newPassword, record.password))
    return NextResponse.json({ message: 'Choose a different new password.' }, { status: 400 })
  const password = await bcrypt.hash(newPassword, 12)
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.user.updateMany({ where: { id: user.id, role: 'USER', accountEnabled: true, password: record.password }, data: { password } })
    if (!result.count) return false
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } })
    await tx.session.deleteMany({ where: { userId: user.id } })
    return true
  })
  if (!updated) return NextResponse.json({ message: 'Account changed. Sign in and retry.' }, { status: 409 })
  loginSucceeded(user.email)
  const response = NextResponse.json({ updated: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
