// Exercise the OTP route with test provider responses and a disposable in-memory reservation.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const handlers = {}
let record = null
const phoneVerification = {
  findUnique: async () => record,
  upsert: async ({ create }) => { record = { ...create } },
  updateMany: async ({ data }) => { Object.assign(record, data); return { count: 1 } },
}
const prisma = { phoneVerification, $transaction: fn => fn({ phoneVerification, $queryRaw: async () => [] }) }
const user = { id: 7, role: 'USER', emailVerified: true, phoneNumber: '+639000000000' }
const code = ts.transpileModule(fs.readFileSync('src/app/api/auth/phone-otp/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
new Function('require', 'exports', code)(name => {
  if (name === '@/lib/auth') return { getCurrentUser: async () => user }
  if (name === '@/lib/prisma') return { prisma }
  return require(name)
}, handlers)
async function run() {
  Object.assign(process.env, { PHONE_OTP_PROVIDER: 'twilio', PHONE_OTP_PEPPER: 'a'.repeat(32),
    TWILIO_ACCOUNT_SID: 'ACfixture', TWILIO_AUTH_TOKEN: 'fixture', TWILIO_FROM_NUMBER: '+10000000000' })
  delete process.env.TWILIO_MESSAGING_SERVICE_SID
  const request = body => new Request('http://localhost/otp', { method: 'POST', body: JSON.stringify(body) })
  let sentCode
  global.fetch = async (url, opts) => {
    assert.equal(url, 'https://api.twilio.com/2010-04-01/Accounts/ACfixture/Messages.json')
    assert.equal(opts.body.get('To'), user.phoneNumber)
    assert.equal(opts.body.get('From'), '+10000000000')
    sentCode = opts.body.get('Body').match(/\d{6}/)[0]
    return Response.json({ sid: 'SMfixture' }, { status: 201 })
  }
  assert.equal((await handlers.POST(request({ action: 'send' }))).status, 200)
  assert.equal((await handlers.POST(request({ action: 'send' }))).status, 429)
  assert.equal((await (await handlers.POST(request({ action: 'verify', code: sentCode }))).json()).verified, true)
  record = null
  global.fetch = async () => Response.json({ code: 1 }, { status: 403 })
  assert.equal((await handlers.POST(request({ action: 'send' }))).status, 502)
  assert.equal(record.otpHash, null)
  console.log('PASS Twilio SMS acceptance, cooldown, verification and rejection')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
