// Offline integration check for the real route handler, with only auth and upstream I/O substituted.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')

const route = fs.readFileSync('src/app/api/backend/[...path]/route.ts', 'utf8')
const { outputText } = ts.transpileModule(route, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const handlers = {}
const user = { id: 1, email: 'test@example.invalid', role: 'BURIAL_ADMIN' }
function load(name) {
  return name === '@/lib/auth' ? { getCurrentUser: async () => user } : require(name)
}
new Function('require', 'exports', outputText)(load, handlers)
process.env.FLASK_API_URL = 'http://127.0.0.1:49999'
process.env.FLASK_INTERNAL_KEY = 'offline-fixture'

async function run() {
  const context = { params: Promise.resolve({ path: ['api', 'requests'] }) }
  const request = new NextRequest('http://localhost/api/backend/api/requests')
  const controller = new AbortController()
  const originalTimeout = AbortSignal.timeout
  const originalFetch = global.fetch
  try {
    AbortSignal.timeout = ms => {
      assert.equal(ms, 90000)
      return controller.signal
    }
    global.fetch = async (url, options) => {
      assert.equal(url.searchParams.get('scope'), 'burial')
      assert.equal(options.signal, controller.signal)
      controller.abort()
      throw Error('Simulated slow upstream')
    }
    const timedOut = await handlers.GET(request, context)
    assert.equal(timedOut.status, 504)
    assert.match((await timedOut.json()).message, /try again/i)
    AbortSignal.timeout = originalTimeout
    let calls = 0
    global.fetch = async () => ++calls === 1
      ? new Response('Starting', { status: 503 })
      : Response.json({ requests: [] })
    const retry = await handlers.GET(request, context)
    assert.equal(calls, 2)
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), { requests: [] })
    let limitedCalls = 0
    global.fetch = async () => {
      limitedCalls++
      return new Response('', { status: 429, headers: { 'Retry-After': '42' } })
    }
    const limited = await handlers.GET(request, context)
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('Retry-After'), '42')
    assert.equal(limitedCalls, 1)
    calls = 0
    global.fetch = async () => ++calls === 1
      ? new Response('<!DOCTYPE html>', { headers: { 'content-type': 'text/html' } })
      : Response.json({ rows: [] })
    const report = await handlers.GET(
      new NextRequest('http://localhost/api/backend/api/reports/certificates'),
      { params: Promise.resolve({ path: ['api', 'reports', 'certificates'] }) }
    )
    assert.equal(calls, 2)
    assert.deepEqual(await report.json(), { rows: [] })
    console.log('PASS interactive read timeout, office scope, transient failure and report HTML recovery')
  } finally {
    AbortSignal.timeout = originalTimeout
    global.fetch = originalFetch
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
