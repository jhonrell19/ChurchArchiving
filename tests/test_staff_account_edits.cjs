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

const provision = loadTs('src/lib/staffProvisioning.ts')
const { POST } = loadTs('src/app/api/admin/staff/managed/route.ts', {
  '@/lib/auth': { getCurrentUser: async () => actor },
  '@/lib/prisma': { prisma: { $transaction: cb => cb(tx) } },
  '@/lib/portalConfig': { isSupervisor: user => user?.id === 1 && user.role === 'ADMIN' },
  '@/lib/staffProvisioning': provision, '@/lib/validation': loadTs('src/lib/validation.ts'),
})
const manage = body => POST({ json: async () => body })
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
  const credentials = { email: ' Document.Office@example.invalid ', password, firstName: 'Ada', surname: 'Reyes' }
  let created
  tx.user.create = async ({data}) => { created = data; return {id: 9} }
  tx.staffMfa = cleanup('authenticator')
  tx.emailVerificationToken = cleanup('verification links')
  assert.equal((await manage({...credentials,action:'create'})).status,200)
  assert.equal(created.email,'document.office@example.invalid')
  assert.equal(created.role,'STAFF')
  assert.equal(created.emailVerified,false)
  assert.ok(provision.supervisorProvisioned(created))
  assert.ok(await bcrypt.compare(password,created.password))
  const login = loadTs('src/app/api/auth/login/route.ts', {
    '@/lib/staffProvisioning': provision, '@/lib/membershipEvidence': {},
    '@/lib/auth': {createSession: () => assert.fail('Password alone issued a session')},
    '@/lib/prisma': {prisma: {user: {findUnique: async () => ({...created,id:9,accountEnabled:true})}}},
    '@/lib/staffMfa': {mfaKeyConfigured: () => true, issueStaffMfaChallenge: async () => 'fictional-challenge',
      MFA_PENDING_COOKIE:'pending', MFA_PENDING_MAX_AGE:300},
    '@/lib/validation': loadTs('src/lib/validation.ts'),
    '@/lib/loginThrottle': {loginAllowed: () => true,loginSucceeded: () => {}},
  })
  const loginResult = await login.POST({json:async () => credentials})
  assert.equal(loginResult.status,200)
  assert.equal((await loginResult.json()).mfaRequired,true)
  assert.ok(loginResult.headers.get('set-cookie').startsWith('pending='))
  assert.deepEqual(actions.splice(0),['audit'])
  assert.equal((await manage({...credentials,action:'credentials',userId:5})).status,200)
  assert.deepEqual(updated.where.role.in,['STAFF','BURIAL_ADMIN'])
  assert.ok(provision.supervisorProvisioned(updated.data))
  assert.deepEqual(actions.splice(0),['sessions','challenges','reset links','verification links','audit'])
  assert.equal((await manage({action:'resetMfa',userId:5})).status,200)
  assert.deepEqual(actions.splice(0),['sessions','challenges','reset links','verification links','authenticator','audit'])
  tx.user.deleteMany = async ({where}) => {
    assert.deepEqual(where,{id:5,role:{in:['STAFF','BURIAL_ADMIN']},accountEnabled:false})
    return {count:0}
  }
  assert.equal((await manage({action:'delete',userId:5})).status,409)
  actor = { ...actor, role: 'STAFF' }
  assert.equal((await manage({...credentials,action:'create'})).status,403)
  assert.equal((await patch({ accountEnabled: true })).status, 403)
  assert.deepEqual(actions, [])
  console.log('PASS staff name, password, access, audit and supervisor boundary')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
