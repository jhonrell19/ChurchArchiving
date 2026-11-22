import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { flushPendingNotifications, notificationFeatureEnabled } from '@/lib/statusNotifications'

const json = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

async function officeForStaff() {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'BURIAL_ADMIN'].includes(user.role)) return null
  return user.role === 'BURIAL_ADMIN' ? 'burial' : 'main'
}

export async function GET() {
  const office = await officeForStaff()
  if (!office) return json({ message: 'Office administrator required.' }, 403)
  if (!notificationFeatureEnabled()) return json({ enabled: false, pending: 0 })
  try {
    const pending = await prisma.notificationEvent.count({
      where: { office, OR: [{ emailState: 'pending' }, { smsState: 'pending' }] },
    })
    return json({ enabled: true, pending, office })
  } catch {
    return json({ message: 'Notification outbox is unavailable.' }, 503)
  }
}

export async function POST() {
  const office = await officeForStaff()
  if (!office) return json({ message: 'Office administrator required.' }, 403)
  if (!notificationFeatureEnabled()) return json({ message: 'Notifications are not enabled.' }, 503)
  try {
    const result = await flushPendingNotifications(office, 5)
    return json(result)
  } catch {
    // Do not expose provider credentials, PII or raw provider response.
    return json({ message: 'Could not process the notification queue. Existing requests and payments are unchanged.' }, 503)
  }
}
