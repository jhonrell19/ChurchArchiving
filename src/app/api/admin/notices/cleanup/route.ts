import {NextRequest,NextResponse} from 'next/server'
import {createHash,timingSafeEqual} from 'node:crypto'
import {prisma} from '@/lib/prisma'
import {getCurrentUser} from '@/lib/auth'
import {isSupervisor} from '@/lib/portalConfig'
import {removeObject} from '@/lib/noticeStudio'

export const runtime='nodejs'
export const dynamic='force-dynamic'
function tokenValid(authorization:string|null) {
  const expected=process.env.PARISH_NOTICE_CLEANUP_SECRET
  if(!expected||expected.length<32||!authorization?.startsWith('Bearer '))return false
  const got=createHash('sha256').update(authorization.slice(7)).digest()
  const wanted=createHash('sha256').update(expected).digest()
  return timingSafeEqual(got,wanted)
}
export async function POST(req:NextRequest){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor)&&!tokenValid(req.headers.get('authorization')))
    return NextResponse.json({message:'Unauthorized'},{status:403})
  try{
    // Hide first, regardless of Storage health. Cleanup can be retried.
    await prisma.$executeRaw`
      UPDATE parish_private.announcement a
         SET active=FALSE
        FROM parish_private.announcement_slide s
       WHERE s.announcement_id=a.id AND a.active=TRUE
         AND s.ends_at < (now() AT TIME ZONE 'Asia/Manila')::date
    `
    const expired=await prisma.$queryRaw<{id:number}[]>`
      SELECT a.id FROM parish_private.announcement a
      JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
      WHERE a.active=FALSE OR s.ends_at < (now() AT TIME ZONE 'Asia/Manila')::date
      ORDER BY a.id LIMIT 30
    `
    let removedMedia=0,removedNotices=0,failedMedia=0
    for(const row of expired){
      // Never touch notices with future publication dates; only inactive/expired.
      const media=await prisma.$queryRaw<{id:bigint;path:string}[]>`
        SELECT id,object_path AS path FROM parish_private.announcement_media
         WHERE announcement_id=${row.id} ORDER BY id
      `
      for(const file of media){
        try{
          await removeObject(file.path)
          await prisma.$executeRaw`DELETE FROM parish_private.announcement_media WHERE id=${file.id}`
          removedMedia++
        }catch{failedMedia++}
      }
      const [count]=await prisma.$queryRaw<{total:number}[]>`
        SELECT COUNT(*)::int AS total FROM parish_private.announcement_media WHERE announcement_id=${row.id}
      `
      if(count.total===0){
        await prisma.$transaction(async tx=>{
          await tx.$executeRaw`DELETE FROM parish_private.announcement_slide WHERE announcement_id=${row.id}`
          await tx.$executeRaw`DELETE FROM parish_private.announcement WHERE id=${row.id} AND active=FALSE`
          await tx.$executeRaw`
            INSERT INTO parish_private.audit_log("user",action,created_at)
            VALUES('Notice retention worker',${'Expired or deleted announcement #'+row.id+' purged'},now())
          `
        })
        removedNotices++
      }
    }
    return NextResponse.json({processed:expired.length,removedMedia,removedNotices,failedMedia},
      {headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({message:'Notice cleanup failed; public date-based filtering remains active.'},{status:503})
  }
}
