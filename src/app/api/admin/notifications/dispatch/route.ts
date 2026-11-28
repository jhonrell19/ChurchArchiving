import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { flushPendingNotifications, notificationFeatureEnabled } from '@/lib/statusNotifications'

const json = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

async function officesForStaff(): Promise<('main' | 'burial')[] | null> {
  const user = await getCurrentUser()
  if (!user) return null
  // Existing legacy Burial Admin can dispatch only their previous office
  // until converted. STAFF operates one queue across both document offices.
  if (user.role === 'STAFF') return ['main', 'burial']
  if (user.role === 'BURIAL_ADMIN') return ['burial']
  return null
}

export async function GET() {
  const offices = await officesForStaff()
  if (!offices) return json({ message: 'Church Staff required.' }, 403)
  if (!notificationFeatureEnabled()) return json({ enabled: false, pending: 0, autoSend: false })
  try {
    const pending = await prisma.notificationEvent.count({
      where: { office: { in: offices }, OR: [{ emailState: 'pending' }, { smsState: 'pending' }] },
    })
    const autoSend = process.env.PARISH_STATUS_AUTO_SEND === 'enabled'
    const smsConfigured = process.env.PARISH_NOTIFICATION_SMS === 'enabled' &&
      process.env.PHONE_OTP_PROVIDER === 'textbee' && Boolean(process.env.TEXTBEE_API_KEY?.trim())
    const emailConfigured = process.env.PARISH_NOTIFICATION_EMAIL === 'enabled' &&
      Boolean(process.env.RESEND_API_KEY?.trim())
    return json({ enabled: true, pending, offices, autoSend, smsConfigured, emailConfigured })
  } catch {
    return json({ message: 'Notification outbox is unavailable.' }, 503)
  }
}

export async function POST() {
  const offices = await officesForStaff()
  if (!offices) return json({ message: 'Church Staff required.' }, 403)
  if (!notificationFeatureEnabled()) return json({ message: 'Notifications are not enabled.' }, 503)
  try {
    let processed = 0
    let acceptedChannels = 0
    for (const office of offices) {
      const result = await flushPendingNotifications(office, 5)
      processed += result.processed
      acceptedChannels += result.acceptedChannels
    }
    return json({ enabled: true, processed, acceptedChannels })
  } catch {
    return json({ message: 'Could not process the notification queue. Requests and payments are unchanged.' }, 503)
  }
}
