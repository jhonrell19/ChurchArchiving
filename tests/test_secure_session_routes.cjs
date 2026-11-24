// Isolated security regression tests. No production database or network access.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const ts = require('typescript')

function transpile(path, resolver) {
  const src = fs.readFileSync(path, 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', js)(
    resolver || require, module, module.exports
  )
  return module.exports
}

const routes = transpile('src/lib/routeAccess.ts')
const policy = pathname => routes.accessRule(pathname)
assert.deepEqual(policy('/admin').roles, ['ADMIN'])
assert.deepEqual(policy('/admin/member-approvals').roles, ['ADMIN'])
assert.deepEqual(policy('/api/admin/staff').roles, ['ADMIN'])
assert.deepEqual(policy('/api/admin/notifications/dispatch').roles, ['STAFF','BURIAL_ADMIN'])
assert.deepEqual(policy('/staff').roles, ['STAFF','BURIAL_ADMIN'])
assert.deepEqual(policy('/dashboard').roles, ['USER'])
assert.deepEqual(policy('/office-reports').roles, ['ADMIN','STAFF','BURIAL_ADMIN'])
assert.equal(routes.roleCanAccess(policy('/admin'), 'USER'), false)
assert.equal(routes.roleCanAccess(policy('/admin'), 'STAFF'), false)
assert.equal(routes.roleCanAccess(policy('/admin'), 'ADMIN'), true)
assert.equal(routes.roleCanAccess(policy('/api/admin/staff'), 'STAFF'), false)
assert.equal(policy('/api/paymongo/webhook'), null)
assert.equal(policy('/api/public-notices'), null)
assert.equal(policy('/api/auth/staff-mfa'), null)
assert.equal(policy('/api/auth/google'), null)
assert.equal(policy('/api/verification'), null)
assert.equal(policy('/api/secret-new-private-endpoint').kind, 'api')
assert.equal(policy('/api/secret-new-private-endpoint').roles.length, 4)

const TOKEN = 'A'.repeat(43)
let record = null
let removed = 0
const fakePrisma = {
  session: {
    findUnique: async ({where}) => {
      assert.equal(where.tokenHash, crypto.createHash('sha256').update(TOKEN).digest('hex'))
      return record
    },
    delete: async () => { removed++ },
  },
}
const validator = transpile('src/lib/sessionValidation.ts', name => {
  if (name === 'server-only') return {}
  if (name === 'node:crypto') return crypto
  if (name === '@/lib/prisma') return { prisma: fakePrisma }
  throw Error('Unexpected validator dependency: '+name)
})
const u = (overrides={}) => ({
  id: 6, email:'member@example.test', role:'USER',
  membershipStatus:'approved', emailVerified:true, accountEnabled:true,
  ...overrides,
})
const valid = user => ({id:55,expiresAt:new Date(Date.now()+300000),user})

class FakeNextResponse {
  constructor(body,opts={}){
    this.body=body
    this.status=opts.status||200
    this.headers=new Headers(opts.headers||{})
    this.cookieChanges=[]
    this.cookies={set:(name,value,options)=>this.cookieChanges.push({name,value,options})}
  }
  static next(){return new FakeNextResponse(null,{status:200})}
  static redirect(url,status=307){
    const r=new FakeNextResponse(null,{status})
    r.headers.set('Location',url.toString())
    return r
  }
  static json(body,opts={}){return new FakeNextResponse(body,opts)}
}

let verified = null
let queries = 0
const proxyModule = transpile('src/proxy.ts', name => {
  if(name==='next/server')return {NextResponse:FakeNextResponse}
  if(name==='@/lib/sessionValidation')return {
    SESSION_COOKIE:'parish_session',
    validateSessionToken:async token=>{queries++;assert.equal(token,TOKEN);return verified},
  }
  if(name==='@/lib/routeAccess')return routes
  throw Error('Unexpected proxy dependency: '+name)
})
function request(path,options={}){
  const url=new URL('https://ifimarag.onrender.com'+path)
  const headers=new Headers(options.headers||{})
  if(options.method&&options.method!=='GET'&&!options.noOrigin&&!headers.has('Origin'))
    headers.set('Origin','https://ifimarag.onrender.com')
  return {
    url:url.href,nextUrl:url,headers,
    method:options.method||'GET',
    cookies:{get:name=>name==='parish_session'&&options.cookie?{value:TOKEN}:undefined},
  }
}
function protectedCache(res){
  assert.match(res.headers.get('Cache-Control'),/no-store/)
  assert.equal(res.headers.get('Pragma'),'no-cache')
  assert.equal(res.headers.get('Expires'),'0')
}

async function main(){
  assert.equal(await validator.validateSessionToken('not-a-session'),null)
  assert.equal(await validator.validateSessionToken(TOKEN),null)
  record=valid(u())
  assert.equal((await validator.validateSessionToken(TOKEN)).id,6)
  for(const overrides of [
    {accountEnabled:false},{emailVerified:false},{membershipStatus:'pending'},
    {membershipStatus:'rejected'},
  ]){
    record=valid(u(overrides))
    assert.equal(await validator.validateSessionToken(TOKEN),null)
  }
  record={id:55,expiresAt:new Date(Date.now()-1000),user:u()}
  assert.equal(await validator.validateSessionToken(TOKEN),null)
  assert.equal(removed,1)
  record=valid(u({role:'ADMIN',membershipStatus:'approved'}))
  assert.equal((await validator.validateSessionToken(TOKEN)).role,'ADMIN')

  process.env.NODE_ENV='production'
  process.env.APP_BASE_URL='https://ifimarag.onrender.com'
  let res=await proxyModule.proxy(request('/admin'))
  assert.equal(res.status,307)
  assert.equal(new URL(res.headers.get('Location')).pathname,'/login')
  protectedCache(res)

  res=await proxyModule.proxy(request('/api/admin/staff'))
  assert.equal(res.status,401)
  protectedCache(res)
  assert.equal(queries,0,'Missing cookie must not hit DB')

  verified=u()
  res=await proxyModule.proxy(request('/admin',{cookie:true}))
  assert.equal(res.status,403)
  protectedCache(res)

  res=await proxyModule.proxy(request('/api/admin/staff',{cookie:true}))
  assert.equal(res.status,403)

  res=await proxyModule.proxy(request('/dashboard',{cookie:true}))
  assert.equal(res.status,200)
  protectedCache(res)

  verified=u({role:'ADMIN'})
  res=await proxyModule.proxy(request('/admin',{cookie:true}))
  assert.equal(res.status,200)
  protectedCache(res)

  verified=u({role:'STAFF'})
  res=await proxyModule.proxy(request('/staff',{cookie:true}))
  assert.equal(res.status,200)
  res=await proxyModule.proxy(request('/admin',{cookie:true}))
  assert.equal(res.status,403)
  res=await proxyModule.proxy(request('/api/admin/notifications/dispatch',{cookie:true}))
  assert.equal(res.status,200)

  verified=null
  res=await proxyModule.proxy(request('/admin',{cookie:true}))
  assert.equal(res.status,307)
  assert.equal(res.cookieChanges.find(c=>c.name==='parish_session').value,'')
  res=await proxyModule.proxy(request('/api/backend/api/masses',{cookie:true}))
  assert.equal(res.status,401)

  res=await proxyModule.proxy(request('/api/public-notices'))
  assert.equal(res.status,200,'Public calendar must work without login')
  res=await proxyModule.proxy(request('/api/paymongo/webhook',{method:'POST',noOrigin:true}))
  assert.equal(res.status,200,'PayMongo webhook uses HMAC, not browser cookie')
  res=await proxyModule.proxy(request('/api/admin/notices/cleanup',{
    method:'POST',noOrigin:true,headers:{Authorization:'Bearer fictional-secret'},
  }))
  assert.equal(res.status,200,'Scheduled cleanup uses its own checked bearer token')

  res=await proxyModule.proxy(request('/api/admin/staff',{
    method:'POST',cookie:true,headers:{Origin:'https://attacker.example.test'},
  }))
  assert.equal(res.status,403,'CSRF must be rejected')
  console.log('PASS real DB session/expiry/revocation/disabled checks, strict route RBAC, direct URL, no-store headers, CSRF and signed cleanup exception')
}
main().catch(e=>{console.error(e);process.exitCode=1})
