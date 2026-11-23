// Isolated media duration/MIME/calendar validation. No database, provider or internet calls.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const path='src/lib/noticeStudio.ts'
const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText
const lib={}
new Function('require','exports',code)(name=>{
  if(name==='server-only')return {}
  if(name==='@/lib/prisma')return {prisma:{}}
  return require(name)
},lib)
function atom(type,payload){
  const h=Buffer.alloc(8);h.writeUInt32BE(payload.length+8);h.write(type,4,4,'ascii')
  return Buffer.concat([h,payload])
}
function mp4(seconds){
  const head=Buffer.alloc(100)
  head.writeUInt32BE(1000,12);head.writeUInt32BE(Math.round(seconds*1000),16)
  return Buffer.concat([atom('ftyp',Buffer.from('isom0000','ascii')),atom('moov',atom('mvhd',head))])
}
assert.equal(lib.inspectMedia(mp4(25),'video/mp4').seconds,25)
assert.equal(lib.inspectMedia(mp4(30),'video/mp4').kind,'video')
assert.throws(()=>lib.inspectMedia(mp4(30.01),'video/mp4'),/at most 30/)
assert.throws(()=>lib.inspectMedia(mp4(25),'image/jpeg'),/did not match/)
assert.throws(()=>lib.inspectMedia(Buffer.from('bad'),'video/mp4'),/did not match/)
const jpeg=Buffer.from([255,216,255,224,1,0,0,0])
assert.equal(lib.inspectMedia(jpeg,'image/jpeg').kind,'image')
const huge=Buffer.alloc(5*1024*1024+1);jpeg.copy(huge)
assert.throws(()=>lib.inspectMedia(huge,'image/jpeg'),/under 5 MB/)
assert.equal(lib.isISODate('2026-11-23'),true)
assert.equal(lib.isISODate('2026-11-31'),false)
assert.equal(lib.isISODate('2026-13-01'),false)
const valid={title:'Parish celebration',body:'Mass time is updated.',category:'Event',
  starts:'2026-11-23',ends:'2026-12-01',date:'2026-12-01',priority:2}
assert.equal(lib.parseNotice(valid).title,valid.title)
assert.equal(lib.parseNotice({...valid,starts:'2026-12-02'}),null)
assert.equal(lib.parseNotice({...valid,priority:101}),null)
assert.equal(lib.parseNotice({...valid,category:'Not a category'}),null)
assert.match(lib.newObjectPath(17,'video/mp4'),/^notices\/17\/[\w-]+\.mp4$/)
const service=fs.readFileSync('src/lib/statusNotifications.ts','utf8')
assert.match(service,/announcementEmail/)
assert.match(service,/announcementSms/)
assert.match(service,/record\.kind\.startsWith\('announcement:'\)/)
assert.match(service,/s\.ends_at >=/)
const proxy=fs.readFileSync('src/app/api/notice-media/[mediaId]/route.ts','utf8')
assert.match(proxy,/a\.active=TRUE/)
assert.match(proxy,/s\.ends_at >=/)
console.log('PASS announcement MP4 duration limit, file signatures/sizes, schedule dates, storage key shapes, consent and public expiry guards')
