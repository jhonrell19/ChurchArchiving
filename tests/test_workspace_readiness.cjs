const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const route = fs.readFileSync('src/app/api/ready/route.ts', 'utf8')
const js = ts.transpileModule(route, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText

async function run() {
  const handlers = {}
  let reads = 0, calls = 0, now = 1000
  new Function('require', 'exports', js)(() => ({prisma: {user: {
    findFirst: async () => { reads++ },
  }}}), handlers)
  process.env.FLASK_API_URL = 'https://fixture.invalid'
  process.env.FLASK_INTERNAL_KEY = 'fictional'
  global.fetch = async () => ++calls === 1
    ? new Response('', {status: 429, headers: {'Retry-After': '60'}})
    : Response.json({database:'ok'})
  Date.now = () => now
  const first = await Promise.all([handlers.GET(), handlers.GET()])
  assert.equal(calls, 1)
  assert.equal(first[0].headers.get('Retry-After'), '60')
  now += 30000
  assert.equal((await handlers.GET()).status, 503)
  assert.equal(calls, 1)
  now += 30000
  assert.equal(await (await handlers.GET()).text(), 'ready')
  assert.equal(reads, 1)
  assert.equal(calls, 2)
  console.log('PASS shared probes, rate-limit cooldown and recovery')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
