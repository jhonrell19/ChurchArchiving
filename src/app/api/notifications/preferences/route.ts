import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notificationFeatureEnabled } from '@/lib/statusNotifications'

const json = (data: object, status = 200) => NextResponse.json(data, {
  status, headers: { 'Cache-Control': 'no-store' },
})

async function parishioner() {
  const user = await getCurrentUser()
  return user?.role === 'USER' && user.emailVerified ? user : null
}

export async function GET() {
  const user = await parishioner()
  if (!user) return json({ message: 'Approved parishioner account required.' }, 401)
  if (!notificationFeatureEnabled()) return json({ enabled: false })
  try {
    const [settings, phone] = await Promise.all([
      prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
      prisma.phoneVerification.findUnique({ where: { userId: user.id } }),
    ])
    const phoneVerified = !!(phone?.verifiedAt && phone.phoneNumber === user.phoneNumber)
    return json({
      enabled: true,
      emailUpdates: settings?.emailUpdates ?? true,
      announcementEmail: settings?.announcementEmail ?? false,
      announcementSms: settings?.announcementSms ?? false,
      smsUpdates: settings?.smsUpdates ?? false,
      phoneVerified,
      phoneEnding: user.phoneNumber?.slice(-4) || '',
    })
  } catch {
    return json({ message: 'Notification preferences unavailable. Ask staff to check database migration.' }, 503)
  }
}

export async function POST(req: Request) {
  const user = await parishioner()
  if (!user) return json({ message: 'Approved parishioner account required.' }, 401)
  if (!notificationFeatureEnabled()) return json({ message: 'Notifications are not enabled.' }, 503)
  const body = await req.json().catch(() => null)
  if (!body || typeof body.smsUpdates !== 'boolean' || typeof body.emailUpdates !== 'boolean')
    return json({ message: 'Specify both SMS and email preferences.' }, 400)
  if (typeof body.announcementEmail !== 'boolean' || typeof body.announcementSms !== 'boolean')
    return json({ message: 'Specify announcement email and SMS preferences too.' }, 400)
  try {
    if (body.smsUpdates || body.announcementSms) {
      const verification = await prisma.phoneVerification.findUnique({ where: { userId: user.id } })
      if (!user.phoneNumber || !/^\+639\d{9}$/.test(user.phoneNumber) ||
          !verification?.verifiedAt || verification.phoneNumber !== user.phoneNumber)
        return json({ message: 'Verify your saved Philippine mobile number before enabling SMS updates.' }, 409)
    }
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, smsUpdates: body.smsUpdates, emailUpdates: body.emailUpdates,
        announcementEmail: body.announcementEmail, announcementSms: body.announcementSms },
      update: { smsUpdates: body.smsUpdates, emailUpdates: body.emailUpdates,
        announcementEmail: body.announcementEmail, announcementSms: body.announcementSms },
    })
    return json({ saved: true, smsUpdates: body.smsUpdates, emailUpdates: body.emailUpdates,
      announcementEmail: body.announcementEmail, announcementSms: body.announcementSms })
  } catch {
    return json({ message: 'Unable to save notification preferences.' }, 503)
  }
}
