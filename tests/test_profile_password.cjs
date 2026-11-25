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

async function run() {
  const oldHash = await bcrypt.hash('Old-fixture-111', 4)
  const user = { id: 71, role: 'USER', email: 'member@example.invalid' }
  const removed = []
  let newHash
  const tx = {
    user: { updateMany: async ({ where, data }) => {
      assert.equal(where.id, user.id)
      assert.equal(where.password, oldHash)
      newHash = data.password
      return { count: 1 }
    } },
    session: { deleteMany: async ({where}) => removed.push(['sessions',where.userId]) },
    passwordResetToken: { deleteMany: async ({where}) => removed.push(['tokens',where.userId]) },
  }
  const { POST } = loadTs('src/app/api/auth/change-password/route.ts', {
    '@/lib/auth': { getCurrentUser: async () => user, SESSION_COOKIE: 'parish_session' },
    '@/lib/loginThrottle': loadTs('src/lib/loginThrottle.ts'),
    '@/lib/validation': loadTs('src/lib/validation.ts'),
    '@/lib/prisma': { prisma: {
      user: { findUnique: async () => ({ password: oldHash }) },
      $transaction: cb => cb(tx),
    } },
  })
  const change = currentPassword => POST({json: async () => ({currentPassword, newPassword: 'New-fixture-222'})})
  assert.equal((await change('wrong')).status, 400)
  assert.deepEqual(removed, [])
  assert.equal((await change('Old-fixture-111')).status, 200)
  assert.ok(await bcrypt.compare('New-fixture-222', newHash))
  assert.deepEqual(removed, [['tokens',71],['sessions',71]])
  user.role = 'STAFF'
  assert.equal((await change('Old-fixture-111')).status, 403)
  console.log('PASS parishioner password change, current-password check and session revocation')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
