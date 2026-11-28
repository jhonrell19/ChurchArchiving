// Offline tests: no real SMS, email, database, or PayMongo calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const crypto = require('node:crypto')

const events = []
let nextId = 1
let phoneVerified = true
let smsOptIn = true
let emailOptIn = true
let userApproved = true
let announcementEmail = false
let announcementSms = false
let activeNotice = true
let sentSms = 0
let sentEmail = 0
const user = () => ({
  email: 'test@example.test', emailVerified: true, role: 'USER',
  membershipStatus: userApproved ? 'approved' : 'rejected',
  phoneNumber: '+639000000000',
  phoneVerification: { phoneNumber: '+639000000000', verifiedAt: phoneVerified ? new Date() : null },
  notificationPreference: { smsUpdates: smsOptIn, emailUpdates: emailOptIn,
    announcementEmail, announcementSms },
})
const prisma = {
  $queryRaw: async () => activeNotice ? [{ id: 7 }] : [],
  user: { findUnique: async () => ({ id: 7, role: 'USER', emailVerified: true, membershipStatus: userApproved ? 'approved' : 'rejected' }) },
  notificationEvent: {
    create: async ({ data }) => {
      if (events.some(item => item.eventKey === data.eventKey)) throw { code: 'P2002' }
      const e = { id: nextId++, ...data, emailState: 'pending', smsState: 'pending', createdAt: new Date() }
      events.push(e)
      return { id: e.id }
    },
    findMany: async ({ where, take }) => events.filter(e => e.office === where.office &&
      (e.emailState === 'pending' || e.smsState === 'pending')).slice(0, take).map(e => ({ id: e.id })),
    findUnique: async ({ where }) => {
      const e = events.find(x => x.id === where.id)
      return e ? { ...e, user: user() } : null
    },
    updateMany: async ({ where, data }) => {
      const e = events.find(x => x.id === where.id && x.office === where.office)
      if (!e || (where.emailState && e.emailState !== where.emailState) ||
          (where.smsState && e.smsState !== where.smsState)) return { count: 0 }
      Object.assign(e, data)
      return { count: 1 }
    },
    update: async ({ where, data }) => {
      const e = events.find(x => x.id === where.id)
      if (!e) throw new Error('missing')
      Object.assign(e, data)
      return e
    },
  },
}
const handlers = {}
const source = fs.readFileSync('src/lib/statusNotifications.ts', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
new Function('require', 'exports', code)(name => {
  if (name === 'server-only') return {}
  if (name === '@/lib/prisma') return { prisma }
  if (name === '@/lib/email') return {
    appBaseUrl: () => 'https://parish.example.test',
    isTransactionalEmailConfigured: () => true,
    sendTransactionalEmail: async () => { sentEmail++; return { sent: true } },
  }
  if (name === 'node:crypto') return crypto
  return require(name)
}, handlers)

async function main() {
  Object.assign(process.env, {
    PARISH_STATUS_NOTIFICATIONS: 'enabled',
    PARISH_STATUS_AUTO_SEND: 'disabled',
    PARISH_NOTIFICATION_EMAIL: 'enabled',
    PARISH_NOTIFICATION_SMS: 'enabled',
    PHONE_OTP_PROVIDER: 'textbee',
    TEXTBEE_API_KEY: 'fixture-key',
    TEXTBEE_DEVICE_ID: 'fixture-device', TEXTBEE_SIM_SLOT_INDEX: '0',
  })
  const approved = {
    id: 42, requesterUserId: 7, sacramentType: 'baptismal',
    status: 'Approved', paymentStatus: 'Unpaid',
  }
  assert.equal(handlers.deriveEvent('status', approved).kind, 'approved')
  assert.equal(handlers.deriveEvent('ready', approved), null)
  assert.equal(handlers.deriveEvent('payment', {
    ...approved, paymentStatus: 'Paid', paymentMethod: 'PAYMONGO_TEST',
  }).kind, 'payment-test')
  assert.equal(handlers.deriveEvent('payment', {
    ...approved, paymentStatus: 'Paid', paymentMethod: 'PAYMONGO_TEST_PENDING',
  }).kind, 'payment-test')
  assert.equal(handlers.deriveEvent('payment', {
    ...approved, paymentStatus: 'Paid', paymentMethod: 'DEMO',
  }).kind, 'payment-test')
  assert.equal(handlers.deriveEvent('payment', {
    ...approved, paymentStatus: 'Paid', paymentMethod: 'PAYMONGO_LIVE',
  }).kind, 'payment-confirmed')
  assert.equal(handlers.notificationOffice('land_agreement'), 'burial')
  assert.equal(handlers.notificationOffice('baptismal'), 'main')

  assert.equal((await handlers.queueRequestNotification('status', approved)).queued, true)
  assert.equal((await handlers.queueRequestNotification('status', approved)).reason, 'already_queued')
  assert.equal(events.length, 1)
  assert.equal(sentSms, 0, 'queue must not automatically send unless enabled')

  global.fetch = async (url, opts) => {
    assert.equal(url, 'https://api.textbee.dev/api/v1/gateway/send-sms')
    assert.equal(opts.headers['x-api-key'], 'fixture-key')
    const data = JSON.parse(opts.body)
    assert.deepEqual(data.recipients, ['+639000000000'])
    assert.equal(data.deviceId, 'fixture-device')
    assert.equal(data.simSlotIndex, 0)
    assert.match(data.message, data.message.includes('announcement') ? /Parish calendar/ : /IFI-REQ-004[23]/)
    sentSms++
    return Response.json({ data: { smsBatchId: 'batch-fixture' } })
  }
  const first = await handlers.flushPendingNotifications('main', 5)
  assert.deepEqual({ processed: first.processed, acceptedChannels: first.acceptedChannels },
    { processed: 1, acceptedChannels: 2 })
  assert.equal(events[0].smsState, 'accepted')
  assert.equal(events[0].emailState, 'accepted')
  assert.equal(events[0].smsBatchId, 'batch-fixture')
  assert.equal(sentSms, 1)
  await handlers.flushPendingNotifications('main', 5)
  assert.equal(sentSms, 1, 'an accepted notification must never resend')

  // Even a valid payment event cannot text an opted-out/ unverified recipient.
  smsOptIn = false; emailOptIn = false
  const paid = { ...approved, paymentStatus: 'Paid', paymentMethod: 'CASH',
    paymentReference: 'OR-FIXTURE-01' }
  assert.equal((await handlers.queueRequestNotification('payment', paid)).queued, true)
  await handlers.flushPendingNotifications('main')
  assert.equal(events[1].smsState, 'skipped')
  assert.equal(events[1].emailState, 'skipped')
  assert.equal(sentSms, 1)
  assert.equal(sentEmail, 1)

  smsOptIn = true; emailOptIn = true; phoneVerified = false
  const ready = { ...approved, status: 'Ready', generatedFile: 'uploads/releases/fictional.pdf' }
  await handlers.queueRequestNotification('ready', ready)
  await handlers.flushPendingNotifications('main')
  assert.equal(events[2].smsState, 'skipped')
  assert.equal(events[2].emailState, 'accepted')
  assert.equal(sentSms, 1)

  phoneVerified = true
  const burial = { ...approved, id: 43, sacramentType: 'ownership' }
  await handlers.queueRequestNotification('status', burial)
  await handlers.flushPendingNotifications('main')
  assert.equal(events[3].smsState, 'pending', 'main admin cannot drain burial queue')
  await handlers.flushPendingNotifications('burial')
  assert.equal(events[3].smsState, 'accepted')
  assert.equal(sentSms, 2)

  userApproved = false
  const rejectedMember = { ...approved, id: 44 }
  const skipped = await handlers.queueRequestNotification('status', rejectedMember)
  assert.equal(skipped.reason, 'inactive_member')
  assert.equal(events.length, 4)
  // Announcements cannot inherit certificate request opt-in; they need independent consent.
  userApproved = true; phoneVerified = true
  announcementEmail = false; announcementSms = false
  const firstAnnouncement = await prisma.notificationEvent.create({
    data: { userId: 7, requestId: 0, office: 'public',
      kind: 'announcement:7', eventKey: 'fictional-announcement-key-7',
      message: 'Smart Parish: New parish announcement. See the Parish calendar.' },
  })
  await handlers.flushPendingNotifications('public')
  assert.equal(events[4].emailState, 'skipped')
  assert.equal(events[4].smsState, 'skipped')
  assert.equal(sentSms, 2, 'No announcement SMS may inherit request SMS consent')
  announcementEmail = true; announcementSms = true
  const nextAnnouncement = await prisma.notificationEvent.create({
    data: { userId: 7, requestId: 0, office: 'public',
      kind: 'announcement:8', eventKey: 'fictional-announcement-key-8',
      message: 'Smart Parish: New parish announcement. See the Parish calendar.' },
  })
  const broadcast = await handlers.flushPendingNotifications('public')
  assert.deepEqual([broadcast.processed, broadcast.acceptedChannels], [1, 2])
  assert.equal(events[5].smsState, 'accepted')
  assert.equal(events[5].emailState, 'accepted')
  assert.equal(sentSms, 3)
  await handlers.flushPendingNotifications('public')
  assert.equal(sentSms, 3, 'Accepted announcement must not send twice')
  activeNotice = false
  await prisma.notificationEvent.create({
    data: { userId: 7, requestId: 0, office: 'public',
      kind: 'announcement:9', eventKey: 'fictional-expired-announcement-key-9',
      message: 'Smart Parish: Old parish announcement. See the Parish calendar.' },
  })
  await handlers.flushPendingNotifications('public')
  assert.equal(events[6].smsState, 'skipped', 'An expired notice must not be sent')
  assert.equal(events[6].emailState, 'skipped')
  assert.match(source, /uncertain/, 'unknown provider outcomes should never automatically retry')
  assert.match(fs.readFileSync('src/app/api/paymongo/webhook/route.ts', 'utf8'),
    /queueRequestNotification\('payment'/)
  console.log('PASS idempotency, staff/payment events, opt-in, verified phone, office separation, provider acceptance vs delivery')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
