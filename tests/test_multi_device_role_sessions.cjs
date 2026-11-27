// Offline role-session isolation tests: no real DB, network or user credentials.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const crypto = require('node:crypto')

function load(path, resolve) {
  const source = fs.readFileSync(path, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports)
  return module.exports
}

async function main() {
  let rows=[], allSessionsDeleted=0, localRevocations=[]
  const db={session:{
    create:async ({data})=>rows.push(data),
    deleteMany:async ({where})=>{
      if(where.userId !== undefined)allSessionsDeleted++
      localRevocations.push(where)
    }
  }}
  const auth=load('src/lib/auth.ts', name=>{
    if(name==='node:crypto') return crypto
    if(name==='next/headers') return {cookies:async()=>({get:()=>undefined})}
    if(name==='next/navigation')return {redirect:()=>{throw Error('unexpected redirect')}}
    if(name==='@/lib/prisma')return {prisma:db}
    if(name==='@/lib/sessionValidation')return {
      hashSessionToken:s=>crypto.createHash('sha256').update(s).digest('hex'),
      SESSION_COOKIE:'parish_session',validateSessionToken:async()=>null
    }
    throw Error('unexpected auth import '+name)
  })
  const first=await auth.createSession(7)
  const second=await auth.createSession(7)
  assert.notEqual(first.token,second.token,'each browser receives distinct token')
  assert.equal(rows.length,2,'both sessions coexist')
  assert.equal(allSessionsDeleted,0,'logging in must not erase another device session')
  await auth.destroySessionToken(first.token)
  assert.equal(localRevocations.length,1)
  assert.equal(localRevocations[0].tokenHash,crypto.createHash('sha256').update(first.token).digest('hex'))

  class Response {
    constructor(body,opts={}) {
      this.body=body;this.status=opts.status||200
      this.headers=new Headers(opts.headers||{})
      this.cookieChanges=[]
      this.cookies={set:(name,value,options)=>this.cookieChanges.push({name,value,options})}
    }
    static json(body,opts={}){return new Response(body,opts)}
  }
  let accountRole='STAFF',previousToken='old-session-token',mfaCount=0
  const login=load('src/app/api/auth/login/route.ts',name=>{
    if(name==='@/lib/staffProvisioning')return {supervisorProvisioned:()=>false}
    if(name==='@/lib/membershipEvidence')return {evidenceEnabled:()=>false,pendingEvidenceResponse:()=>null}
    if(name==='bcryptjs')return {__esModule:true,default:{compare:async()=>true}}
    if(name==='next/server')return {NextResponse:Response}
    if(name==='next/headers')return {cookies:async()=>({get:key=>key==='parish_session'?{value:previousToken}:undefined})}
    if(name==='@/lib/auth')return {
      createSession:async(userId)=>({token:'new-session-for-'+userId}),
      destroySessionToken:async(token)=>{localRevocations.push({token})},
      isUserProfileComplete:()=>true,SESSION_COOKIE:'parish_session',
      SESSION_MAX_AGE_SECONDS:604800,STAFF_SESSION_MAX_AGE_SECONDS:43200,
    }
    if(name==='@/lib/prisma')return {prisma:{user:{findUnique:async()=>({
      id:15,email:'example@test.invalid',role:accountRole,
      accountEnabled:true,emailVerified:true,membershipStatus:'approved',
      password:'valid-hash',firstName:'Test',surname:'Account'
    })}}}
    if(name==='@/lib/staffMfa')return {
      MFA_PENDING_COOKIE:'parish_mfa_pending',MFA_PENDING_MAX_AGE:600,
      issueStaffMfaChallenge:async()=>{mfaCount++;return 'pending-MFA-token'},
      mfaKeyConfigured:()=>true
    }
    if(name==='@/lib/validation')return {normalizeEmail:x=>x}
    if(name==='@/lib/loginThrottle')return {
      loginAllowed:()=>true,loginFailed:()=>{},loginSucceeded:()=>{}
    }
    throw Error('unexpected login import '+name)
  })
  const makeReq=()=>new Request('https://ifimarag.onrender.com/api/auth/login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'example@test.invalid',password:'valid-password'})
  })
  const staff=await login.POST(makeReq())
  assert.equal(staff.status,200)
  assert.equal(staff.body.mfaRequired,true)
  assert.equal(staff.cookieChanges.find(x=>x.name==='parish_session').value,'')
  assert.equal(staff.cookieChanges.find(x=>x.name==='parish_mfa_pending').value,'pending-MFA-token')
  assert.ok(localRevocations.some(x=>x.token===previousToken),
    'MFA password step must revoke this browser previous ADMIN session')
  assert.equal(mfaCount,1)

  accountRole='USER'
  const user=await login.POST(makeReq())
  assert.equal(user.status,200)
  assert.equal(user.body.user.role,'USER')
  assert.equal(user.cookieChanges.find(x=>x.name==='parish_session').value,'new-session-for-15')
  assert.equal(user.cookieChanges.find(x=>x.name==='parish_mfa_pending').value,'')
  const google=fs.readFileSync('src/app/api/auth/google/route.ts','utf8')
  assert.match(google,/destroySessionToken\(\(await cookies\(\)\)\.get\(SESSION_COOKIE\)\?\.value\)/)
  assert.match(google,/response\.cookies\.set\(MFA_PENDING_COOKIE, ''/)
  assert.match(google,/if \(user\.role !== 'USER'\)/)
  console.log('PASS independent device sessions, local-only revocation, no lingering ADMIN during STAFF MFA, role-correct password and Google login cookies')
}
main().catch(error=>{console.error(error);process.exitCode=1})
