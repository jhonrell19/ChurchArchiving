const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const bcrypt = require('bcryptjs')

function loadTs(path, dependencies = {}) {
  const source = fs.readFileSync(path, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const exports = {}
  new Function('require', 'exports', js)(name => dependencies[name] ?? require(name), exports)
  return exports
}

let actor = { id: 1, email: 'admin@example.invalid', role: 'ADMIN' }
const actions = []
let updated
const cleanup = name => ({ deleteMany: async () => actions.push(name) })
const tx = {
  user: { updateMany: async args => { updated = args; return { count: 1 } } },
  session: cleanup('sessions'), staffMfaChallenge: cleanup('challenges'),
  passwordResetToken: cleanup('reset links'), $executeRaw: async () => actions.push('audit'),
}
const { PATCH } = loadTs('src/app/api/admin/staff/route.ts', {
  '@/lib/auth': { getCurrentUser: async () => actor },
  '@/lib/prisma': { prisma: { $transaction: cb => cb(tx) } },
  '@/lib/portalConfig': { isSupervisor: user => user?.role === 'ADMIN' },
  '@/lib/accountTokens': {}, '@/lib/email': {},
  '@/lib/validation': loadTs('src/lib/validation.ts'),
})
const patch = body => PATCH({ json: async () => ({ userId: 5, ...body }) })

async function run() {
  assert.equal((await patch({ action: 'name', firstName: ' Ada ', surname: 'Reyes' })).status, 200)
  assert.deepEqual(updated.data, { firstName: 'Ada', surname: 'Reyes' })
  assert.deepEqual(updated.where.role.in, ['STAFF', 'BURIAL_ADMIN'])
  assert.deepEqual(actions.splice(0), ['audit'])
  assert.equal((await patch({ action: 'password', password: 'short' })).status, 400)
  const password = 'Fictional-Staff-123'
  assert.equal((await patch({ action: 'password', password })).status, 200)
  assert.ok(await bcrypt.compare(password, updated.data.password))
  assert.equal(updated.where.emailVerified, true)
  assert.deepEqual(actions.splice(0), ['sessions', 'challenges', 'reset links', 'audit'])
  for (const accountEnabled of [false, true]) {
    assert.equal((await patch({ accountEnabled })).status, 200)
    assert.deepEqual(updated.data, { accountEnabled })
    assert.deepEqual(actions.splice(0), ['sessions', 'challenges', 'audit'])
  }
  actor = { ...actor, role: 'STAFF' }
  assert.equal((await patch({ accountEnabled: true })).status, 403)
  assert.deepEqual(actions, [])
  console.log('PASS staff name, password, access, audit and supervisor boundary')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
