// POST logout revocation + 303 redirect regression. Offline fixtures only.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const cache={}
let revoked=[],revocationFails=false,mfaRemoved=0
class ResponseStub {
  constructor(body,options={}){
    this.body=body;this.status=options.status||200;this.headers=new Headers(options.headers)
    this.cookieChanges=[];this.cookies={set:(name,value,opts)=>this.cookieChanges.push({name,value,opts})}
  }
  static redirect(url,status){const r=new ResponseStub(null,status);r.headers.set('Location',url.toString());return r}
  static json(body,options={}){const r=new ResponseStub(body,options);for(const [k,v] of Object.entries(options.headers||{}))r.headers.set(k,v);return r}
}
const source=fs.readFileSync('src/app/api/auth/logout/route.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
new Function('require','exports',js)(name=>{
 if(name==='next/server')return {NextResponse:ResponseStub}
 if(name==='@/lib/auth')return {
   SESSION_COOKIE:'parish_session',
   destroySessionToken:async token=>{if(revocationFails)throw Error('DB unavailable');revoked.push(token)},
 }
 if(name==='@/lib/staffMfa')return {
   MFA_PENDING_COOKIE:'parish_mfa_pending',
   findValidStaffChallenge:async token=>token?{id:17}:null,
 }
 if(name==='@/lib/prisma')return {prisma:{staffMfaChallenge:{deleteMany:async()=>{mfaRemoved++}}}}
 if(name==='@/lib/routeAccess')return {
   PRIVATE_CACHE_HEADERS:{'Cache-Control':'private, no-store, no-cache, must-revalidate',
     Pragma:'no-cache',Expires:'0'},
 }
 throw Error('Unexpected logout dependency: '+name)
},cache)
const request={
 url:'https://0.0.0.0:10000/api/auth/logout',
 cookies:{get:n=>n==='parish_session'?{value:'fictional-valid-token'}:
   n==='parish_mfa_pending'?{value:'fictional-mfa'}:undefined}
}
async function run(){
 process.env.NODE_ENV='production'
 const success=await cache.POST(request)
 assert.equal(success.status,303)
 assert.equal(success.headers.get('Location'),'/login')
 assert.deepEqual(revoked,['fictional-valid-token'])
 assert.equal(mfaRemoved,1)
 assert.match(success.headers.get('Cache-Control'),/no-store/)
 assert.equal(success.headers.get('Pragma'),'no-cache')
 assert.equal(success.headers.get('Expires'),'0')
 for(const name of ['parish_session','parish_mfa_pending','token']){
   const cookie=success.cookieChanges.find(change=>change.name===name)
   assert.ok(cookie, 'logout must clear '+name)
   assert.equal(cookie.value,'')
   assert.equal(cookie.opts.httpOnly,true)
   assert.equal(cookie.opts.secure,true)
   assert.equal(cookie.opts.sameSite,'strict')
   assert.equal(cookie.opts.maxAge,0)
 }
 revocationFails=true
 const realError=console.error
 console.error=()=>{}
 let failure
 try {failure=await cache.POST(request)} finally {console.error=realError}
 assert.equal(failure.status,503,'must not claim success if the DB cannot revoke')
 assert.equal(failure.cookieChanges.length,0)
 console.log('PASS database session and MFA revocation, strict cookie deletion, no-store 303 redirect, fail-closed logout')
}
run().catch(e=>{console.error(e);process.exitCode=1})
