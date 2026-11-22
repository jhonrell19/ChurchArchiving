// PayMongo webhook raw-body signature, invalid-signature and replay tests.
// This exercises the Next.js route; the Flask replay test proves ledger idempotency.
const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const fs = require('node:fs')
const ts = require('typescript')
const exports = {}
const moduleCode = ts.transpileModule(
  fs.readFileSync('src/app/api/paymongo/webhook/route.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText
new Function('require', 'exports', moduleCode)(name => {
  if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } }
  return require(name)
}, exports)

async function run() {
  Object.assign(process.env, {
    PAYMONGO_MODE: 'test', PAYMONGO_WEBHOOK_SECRET: 'fictional-32-byte-test-secret',
    FLASK_API_URL: 'https://backend.example.test', FLASK_INTERNAL_KEY: 'fixture-key',
  })
  const data = JSON.stringify({ data: {
    type: 'checkout_session.payment.paid', livemode: false, data: { id: 'cs_fixture' }
  } })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET)
    .update(timestamp + '.' + data).digest('hex')
  const makeRequest = sig => new Request('https://web.example.test/api/paymongo/webhook', {
    method: 'POST', headers: { 'PayMongo-Signature': 't=' + timestamp + ',te=' + sig,
      'Content-Type': 'application/json' }, body: data
  })
  let verifiedCalls = 0
  global.fetch = async (url, options) => {
    assert.equal(url.href ?? String(url), 'https://backend.example.test/api/paymongo/confirm-internal')
    assert.equal(JSON.parse(options.body).checkoutSessionId, 'cs_fixture')
    verifiedCalls++
    return Response.json({ ok: true })
  }
  assert.equal((await exports.POST(makeRequest('0'.repeat(64)))).status, 401)
  assert.equal(verifiedCalls, 0)
  assert.equal((await exports.POST(makeRequest(signature))).status, 200)
  assert.equal((await exports.POST(makeRequest(signature))).status, 200)
  assert.equal(verifiedCalls, 2)
  global.fetch = async () => Response.json({ error: 'Not confirmed' }, { status: 503 })
  assert.equal((await exports.POST(makeRequest(signature))).status, 503)
  console.log('PASS raw HMAC, rejects forgery, forwards replay for idempotent ledger, rejects upstream failure')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
