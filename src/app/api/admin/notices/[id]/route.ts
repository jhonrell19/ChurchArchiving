import { NextRequest,NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { removeObject } from '@/lib/noticeStudio'
import { parseNotice } from '../route'

export const runtime='nodejs'
type Context={params:Promise<{id:string}>}
const json=(d:object,status=200)=>NextResponse.json(d,{status,headers:{'Cache-Control':'no-store'}})
async function valid(reqContext:Context){const {id}=await reqContext.params;const n=Number(id);return Number.isSafeInteger(n)&&n>0?n:null}
export async function PUT(req:NextRequest,ctx:Context){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  const id=await valid(ctx)
  const parsed=parseNotice(await req.json().catch(()=>null))
  if(!id||!parsed)return json({message:'Invalid announcement or scheduling details.'},400)
  try{
    const count=await prisma.$transaction(async tx=>{
      const result=await tx.$executeRaw`
        UPDATE parish_private.announcement SET title=${parsed.title},body=${parsed.body},
          category=${parsed.category},announcement_date=${parsed.date}
        WHERE id=${id} AND active=TRUE
      `
      if(!result)return 0
      await tx.$executeRaw`
        INSERT INTO parish_private.announcement_slide(announcement_id,priority,starts_at,ends_at,image_path)
        VALUES(${id},${parsed.priority},${parsed.starts}::date,${parsed.ends}::date,NULL)
        ON CONFLICT(announcement_id) DO UPDATE SET priority=EXCLUDED.priority,
          starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at
      `
      await tx.$executeRaw`
        INSERT INTO parish_private.audit_log("user",action,created_at)
        VALUES(${actor!.email},${'Updated announcement #'+id},now())
      `
      return result
    })
    return count?json({updated:true}):json({message:'Announcement not found'},404)
  }catch{return json({message:'Unable to save announcement changes.'},503)}
}
export async function DELETE(_:NextRequest,ctx:Context){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  const id=await valid(ctx)
  if(!id)return json({message:'Invalid announcement'},400)
  try{
    // Hide immediately, then reclaim uploaded media. Audits remain.
    const marked=await prisma.$executeRaw`
      UPDATE parish_private.announcement SET active=FALSE WHERE id=${id} AND active=TRUE
    `
    if(!marked)return json({message:'Announcement already inactive or missing'},404)
    const media=await prisma.$queryRaw<{id:bigint;path:string}[]>`
      SELECT id,object_path AS path FROM parish_private.announcement_media WHERE announcement_id=${id}
    `
    let removed=0
    for(const entry of media){
      try{
        await removeObject(entry.path)
        await prisma.$executeRaw`DELETE FROM parish_private.announcement_media WHERE id=${entry.id}`
        removed++
      }catch{ /* Retry using the authenticated cleanup endpoint. */ }
    }
    await prisma.$executeRaw`
      INSERT INTO parish_private.audit_log("user",action,created_at)
      VALUES(${actor!.email},${'Archived announcement #'+id},now())
    `
    return json({deletedFromPublic:true,removedMedia:removed,remainingMedia:media.length-removed})
  }catch{return json({message:'Could not deactivate announcement.'},503)}
}
