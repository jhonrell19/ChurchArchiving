const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const crypto=require('node:crypto')

const src=fs.readFileSync('src/lib/noticeStudio.ts','utf8')
const compiled=ts.transpileModule(src,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText

let slidesReady=false,mediaReady=false,mediaFetches=0
const row={id:12,title:'Sunday Mass',body:'Service at 8 AM',category:'Schedule',
  date:'2026-11-29',starts:'2026-11-24',ends:'2026-11-30',priority:1,
  active:true,createdAt:new Date('2026-11-24T00:00:00Z')}
const prisma={
  $queryRaw:async (strings,...vals)=>{
    const sql=strings.join('?')
    if(sql.includes('to_regclass('))return [{slidesReady,mediaReady}]
    if(sql.includes('FROM parish_private.announcement_media')){
      mediaFetches++
      return [{id:BigInt(9),announcementId:12,objectPath:'notices/12/example.jpg',
        originalName:'parish.jpg',mediaType:'image',mimeType:'image/jpeg',
        sizeBytes:1000,durationSeconds:null,displaySeconds:8,sortOrder:0}]
    }
    if(sql.includes('FROM parish_private.announcement')){
      assert.match(sql,/a.active=TRUE/)
      if(slidesReady)assert.match(sql,/s.ends_at >=/)
      else assert.doesNotMatch(sql,/JOIN parish_private.announcement_slide/)
      return [row]
    }
    throw Error('Unexpected SQL:'+sql.slice(0,100))
  }
}
const sandboxModule={exports:{}}
new Function('require','module','exports',compiled)(name=>{
  if(name==='server-only')return {}
  if(name==='node:crypto')return crypto
  if(name==='@/lib/prisma')return {prisma}
  throw Error('Unexpected module '+name)
},sandboxModule,sandboxModule.exports)
const {publicNotices}=sandboxModule.exports
async function main(){
  let notices=await publicNotices()
  assert.equal(notices[0].title,'Sunday Mass')
  assert.deepEqual(notices[0].media,[])
  assert.equal(mediaFetches,0)

  slidesReady=true
  notices=await publicNotices()
  assert.equal(notices[0].starts,'2026-11-24')
  assert.equal(mediaFetches,0)

  mediaReady=true
  notices=await publicNotices()
  assert.equal(notices[0].media.length,1)
  assert.equal(notices[0].media[0].url,'/api/notice-media/9')
  assert.equal(mediaFetches,1)

  for(const page of [
    'src/app/admin/AdminPanel.tsx','src/app/staff/page.tsx',
    'src/app/dashboard/UserDashboard.tsx']){
    const text=fs.readFileSync(page,'utf8')
    assert.match(text,/<WorkspaceShell /)
    assert.doesNotMatch(text,/fetch\(['"]\/api\/auth\/logout/)
  }
  assert.match(fs.readFileSync('src/components/WorkspaceShell.tsx','utf8'), /<SignOutForm \/>/)
  assert.match(fs.readFileSync('src/components/auth/SignOutForm.tsx','utf8'),
    /<form method="post" action="\/api\/auth\/logout">/)
  const header=fs.readFileSync('src/app/components/Navbar.tsx','utf8')
  assert.match(header,/const PUBLIC_LINKS = \[/)
  assert.doesNotMatch(header,/Dashboard|\/admin|\/staff|\/dashboard/)
  assert.doesNotMatch(header,/fetch\(['"]\/api\/auth\/me/)
  // The private routes are not exposed by navigation, and access is still
  // enforced independently on the server for direct URL attempts.
  const policy=fs.readFileSync('src/lib/routeAccess.ts','utf8')
  assert.match(policy,/if \(under\(pathname, '\/admin'\)\)/)
  assert.match(policy,/roles: \['ADMIN'\]/)
  const profile=fs.readFileSync('src/app/dashboard/components/ProfilePage.tsx','utf8')
  assert.match(profile,/mx-auto w-full max-w-3xl/)
  const calendar=fs.readFileSync('src/app/dashboard/components/AnnouncementsPage.tsx','utf8')
  assert.match(calendar,/    <ParishCalendar services=\{services\}/)
  assert.doesNotMatch(calendar,/!error&&<ParishCalendar/)
  console.log('PASS: native sign-out, public-only header, server role guard, centered profile, calendar uptime, notices with optional schema')
}
main().catch(error=>{console.error(error);process.exitCode=1})
