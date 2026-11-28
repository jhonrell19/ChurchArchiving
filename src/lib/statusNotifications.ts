import 'server-only'

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { appBaseUrl, isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email'

/** Snapshot ONLY from a successful authenticated Flask mutation or verified webhook. */
export type NotificationSnapshot = {
  id: number
  requesterUserId?: number | null
  sacramentType?: string | null
  status?: string | null
  paymentStatus?: string | null
  paymentMethod?: string | null
  paymentReference?: string | null
  generatedFile?: string | null
}
export type NotificationAction = 'submitted' | 'status' | 'ready' | 'payment' | 'cancelled'
export function notificationFeatureEnabled() {
  return process.env.PARISH_STATUS_NOTIFICATIONS === 'enabled'
}
export function deriveEvent(action: NotificationAction, req: NotificationSnapshot) {
  if (!Number.isSafeInteger(req.id) || req.id <= 0) return null
  const code = 'IFI-REQ-' + String(req.id).padStart(4, '0')
  if (action === 'submitted' && req.status === 'Pending')
    return { kind: 'submitted', text: 'Smart Parish: ' + code + ' was submitted. Log in to track staff verification and payment.' }
  if (action === 'cancelled' && req.status === 'Cancelled')
    return { kind:'cancelled', text:'Smart Parish: '+code+' has been cancelled. Your request history remains available in the portal.' }
  if (action === 'status') {
    if (req.status === 'Approved')
      return { kind: 'approved', text: 'Smart Parish: ' + code + ' was approved by staff. Log in for payment and preparation details.' }
    if (req.status === 'Rejected')
      return { kind: 'rejected', text: 'Smart Parish: ' + code + ' needs your attention. Log in to review the request decision.' }
    if (req.status === 'Released')
      return { kind: 'released', text: 'Smart Parish: ' + code + ' was marked released by staff. Confirm physical pickup of the signed original with the parish office.' }
  }
  if (action === 'ready' && req.status === 'Ready' && req.generatedFile)
    return { kind: 'ready', text: 'Smart Parish: ' + code + ' document is prepared. Log in for payment status and official pickup instructions.' }
  if (action === 'payment') {
    const method = (req.paymentMethod || '').toUpperCase()
    if (req.paymentStatus === 'Paid' && (method === 'DEMO' || method.startsWith('PAYMONGO_TEST')))
      return { kind: 'payment-test', text: 'Smart Parish TEST: ' + code + ' simulated payment recorded. NO real funds were collected; this does not permit certificate release.' }
    if (req.paymentStatus === 'Paid' && ['PAYMONGO_LIVE', 'CASH'].includes(req.paymentMethod || ''))
      return { kind: 'payment-confirmed', text: 'Smart Parish: Verified payment for ' + code + ' was recorded. Log in to check document and pickup status.' }
    if (req.paymentStatus === 'Unpaid' && req.paymentMethod === 'CASH_REVERSED')
      return { kind: 'payment-reversed', text: 'Smart Parish: A cash payment record for ' + code + ' was reversed. Contact the parish office for details.' }
  }
  return null
}
export function deliveryKey(action: NotificationAction, req: NotificationSnapshot) {
  const event = deriveEvent(action, req)
  if (!event) return null
  const unique = [req.id, req.requesterUserId, event.kind,
    action === 'payment' ? req.paymentReference || '' : ''].join(':')
  return createHash('sha256').update(unique).digest('hex')
}
export function notificationOffice(sacramentType?: string | null): 'main' | 'burial' {
  return ['ownership', 'land_agreement', 'burial'].includes(sacramentType || '') ? 'burial' : 'main'
}
/** Persist after Flask commit. Never compromise financial state on SMS failure. */
export async function queueRequestNotification(action: NotificationAction, req: NotificationSnapshot) {
  if (!notificationFeatureEnabled()) return { queued: false, reason: 'disabled' }
  if (!Number.isSafeInteger(req.requesterUserId) || (req.requesterUserId || 0) <= 0)
    return { queued: false, reason: 'no_parishioner' }
  const details = deriveEvent(action, req)
  const eventKey = deliveryKey(action, req)
  if (!details || !eventKey) return { queued: false, reason: 'no_transition' }
  const user = await prisma.user.findUnique({
    where: { id: req.requesterUserId! },
    select: { id: true, role: true, emailVerified: true, membershipStatus: true },
  })
  if (!user || user.role !== 'USER' || !user.emailVerified ||
      user.membershipStatus !== 'approved')
    return { queued: false, reason: 'inactive_member' }
  try {
    const created = await prisma.notificationEvent.create({
      data: {
        eventKey, userId: user.id, requestId: req.id,
        office: notificationOffice(req.sacramentType),
        kind: details.kind, message: details.text,
      },
      select: { id: true },
    })
    // Off by default on free Render to avoid delaying staff payment writes.
    if (process.env.PARISH_STATUS_AUTO_SEND === 'enabled')
      await dispatchNotification(created.id, notificationOffice(req.sacramentType))
    return { queued: true, eventId: created.id }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      return { queued: false, reason: 'already_queued' }
    throw error
  }
}
type Channel = 'email' | 'sms'
type Office = 'main' | 'burial' | 'public'
async function dispatchChannel(id: number, office: Office, channel: Channel) {
  // Claim atomically across concurrent requests to avoid provider duplicates.
  const claimed = await prisma.notificationEvent.updateMany({
    where: channel === 'email' ? { id, office, emailState: 'pending' } :
      { id, office, smsState: 'pending' },
    data: channel === 'email' ? { emailState: 'processing', emailAttemptedAt: new Date() } :
      { smsState: 'processing', smsAttemptedAt: new Date() },
  })
  if (claimed.count !== 1) return false
  try {
    const record = await prisma.notificationEvent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true, emailVerified: true, role: true, membershipStatus: true,
            phoneNumber: true,
            phoneVerification: { select: { phoneNumber: true, verifiedAt: true } },
            notificationPreference: { select: { smsUpdates: true, emailUpdates: true, announcementEmail: true, announcementSms: true } },
          },
        },
      },
    })
    if (!record || record.office !== office || record.user.role !== 'USER' ||
        record.user.membershipStatus !== 'approved' || !record.user.emailVerified) {
      await prisma.notificationEvent.update({ where: { id },
        data: channel === 'email' ? { emailState: 'skipped' } : { smsState: 'skipped' } })
      return false
    }
    const announcement = record.kind.startsWith('announcement:')
    if (announcement) {
      const announcementId = Number(record.kind.slice('announcement:'.length))
      if (!Number.isSafeInteger(announcementId) || announcementId <= 0) {
        await prisma.notificationEvent.update({where:{id},data:channel==='email'?{emailState:'skipped'}:{smsState:'skipped'}})
        return false
      }
      // Never send announcements that have passed their publication deadline.
      const available = await prisma.$queryRaw<{id:number}[]>`
        SELECT a.id FROM parish_private.announcement a
        JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
        WHERE a.id=${announcementId} AND a.active=TRUE
          AND s.starts_at <= (now() AT TIME ZONE 'Asia/Manila')::date
          AND s.ends_at >= (now() AT TIME ZONE 'Asia/Manila')::date
      `
      if(!available.length){
        await prisma.notificationEvent.update({where:{id},data:channel==='email'?{emailState:'skipped'}:{smsState:'skipped'}})
        return false
      }
    }
    if (channel === 'email') {
      if (process.env.PARISH_NOTIFICATION_EMAIL !== 'enabled' ||
          (announcement
            ? record.user.notificationPreference?.announcementEmail !== true
            : record.user.notificationPreference?.emailUpdates === false)) {
        await prisma.notificationEvent.update({ where: { id }, data: { emailState: 'skipped' } })
        return false
      }
      if (!isTransactionalEmailConfigured()) {
        await prisma.notificationEvent.update({ where: { id }, data: { emailState: 'rejected' } })
        return false
      }
      const messageHtml = record.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const destination = announcement ? '/' : '/dashboard'
      const html = '<p>' + messageHtml + '</p><p>For details visit <a href="' +
        appBaseUrl() + destination + '">Smart Parish</a>. Never share OTP codes.</p>' +
        (announcement ? '<p>To stop parish announcement emails, update your notification preferences in My Account.</p>' : '')
      const sent = await sendTransactionalEmail({
        to: record.user.email,
        subject: announcement ? 'Smart Parish announcement' : 'Smart Parish request update', html,
      })
      // Unknown provider failures may be accepted remotely; do not auto-retry.
      await prisma.notificationEvent.update({ where: { id },
        data: { emailState: sent.sent ? 'accepted' : 'uncertain' } })
      return sent.sent
    }
    const phone = record.user.phoneNumber
    const phoneVerified = !!(phone && /^\+639\d{9}$/.test(phone) &&
      record.user.phoneVerification?.verifiedAt &&
      record.user.phoneVerification.phoneNumber === phone)
    if (process.env.PARISH_NOTIFICATION_SMS !== 'enabled' ||
        process.env.PHONE_OTP_PROVIDER !== 'textbee' ||
        !(announcement
          ? record.user.notificationPreference?.announcementSms
          : record.user.notificationPreference?.smsUpdates) || !phoneVerified) {
      await prisma.notificationEvent.update({ where: { id }, data: { smsState: 'skipped' } })
      return false
    }
    if (!process.env.TEXTBEE_API_KEY?.trim()) {
      await prisma.notificationEvent.update({ where: { id }, data: { smsState: 'rejected' } })
      return false
    }
    const payload: { recipients: string[]; message: string; deviceId?: string; simSlotIndex?: number } = {
      recipients: [phone!], message: record.message,
    }
    if (process.env.TEXTBEE_DEVICE_ID?.trim()) payload.deviceId = process.env.TEXTBEE_DEVICE_ID.trim()
    const slot = process.env.TEXTBEE_SIM_SLOT_INDEX
    if (slot && /^[0-7]$/.test(slot)) payload.simSlotIndex = Number(slot)
    const res = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
      method: 'POST', cache: 'no-store',
      headers: { 'x-api-key': process.env.TEXTBEE_API_KEY.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    })
    const result = await res.json().catch(() => ({})) as {
      smsBatchId?: string
      data?: { smsBatchId?: string; success?: boolean }
    }
    const accepted = res.ok && result.data?.success !== false
    const batch = result.data?.smsBatchId || result.smsBatchId
    await prisma.notificationEvent.update({ where: { id },
      data: {
        smsState: accepted ? 'accepted' : (res.status >= 500 ? 'uncertain' : 'rejected'),
        smsBatchId: accepted && typeof batch === 'string' && batch.length <= 128 ? batch : null,
      },
    })
    // HTTP success means QUEUED by textbee, NOT delivered to handset.
    return accepted
  } catch {
    await prisma.notificationEvent.update({ where: { id },
      data: channel === 'email' ? { emailState: 'uncertain' } : { smsState: 'uncertain' },
    }).catch(() => undefined)
    // Timeout might happen after sending. Never automatically repeat.
    return false
  }
}
export async function dispatchNotification(id: number, office: Office) {
  if (!notificationFeatureEnabled()) return { processed: false, acceptedChannels: 0 }
  const result = await Promise.allSettled([
    dispatchChannel(id, office, 'email'),
    dispatchChannel(id, office, 'sms'),
  ])
  return { processed: true, acceptedChannels: result.filter(r => r.status === 'fulfilled' && r.value).length }
}
export async function flushPendingNotifications(office: Office, limit = 5) {
  if (!notificationFeatureEnabled()) return { processed: 0, enabled: false, acceptedChannels: 0 }
  const pending = await prisma.notificationEvent.findMany({
    where: { office, OR: [{ emailState: 'pending' }, { smsState: 'pending' }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: Math.max(1, Math.min(5, limit)),
  })
  let acceptedChannels = 0
  for (const event of pending) {
    const sent = await dispatchNotification(event.id, office)
    acceptedChannels += sent.acceptedChannels
  }
  return { processed: pending.length, acceptedChannels, enabled: true }
}
