import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notificationFeatureEnabled } from '@/lib/statusNotifications'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'USER' || !user.emailVerified)
    return NextResponse.json({ message: 'Approved parishioner account required.' }, { status: 401 })
  if (!notificationFeatureEnabled())
    return NextResponse.json({ enabled: false, events: [] }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    const events = await prisma.notificationEvent.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 12,
      select: { id: true, requestId: true, kind: true, message: true, createdAt: true,
        smsState: true, emailState: true },
    })
    return NextResponse.json({ enabled: true, events }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ message: 'Request alerts are temporarily unavailable.' }, { status: 503 })
  }
}
