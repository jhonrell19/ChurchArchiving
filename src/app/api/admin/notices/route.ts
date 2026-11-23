import { NextRequest,NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { formatNotices,isISODate,studioConfigured,type MediaRow,type NoticeRow } from '@/lib/noticeStudio'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}})
const categories=['Event','Schedule','Ministry','Sacrament','Public calendar notice','General']
export function parseNotice(data:any){
  if(!data||typeof data!=='object')return null
  const title=typeof data.title==='string'?data.title.trim():''
  const body=typeof data.body==='string'?data.body.trim():''
  const category=typeof data.category==='string'?data.category:'Event'
  const starts=data.starts
  const ends=data.ends
  const date=data.date||null
  const priority=Number(data.priority||0)
  if(!title||title.length>180||!body||body.length>2000||!categories.includes(category)||
     !isISODate(starts)||!isISODate(ends)||starts>ends||(date!==null&&!isISODate(date))||
     !Number.isSafeInteger(priority)||priority< -100||priority>100)return null
  const startDate=new Date(starts+'T12:00:00Z')
  const endDate=new Date(ends+'T12:00:00Z')
  if(endDate.getTime()-startDate.getTime()>366*86400000)return null
  return {title,body,category,starts,ends,date,priority}
}
export async function GET(){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  try{
    const rows=await prisma.$queryRaw<NoticeRow[]>`
      SELECT a.id,a.title,a.body,a.category,a.announcement_date AS date,
        s.starts_at::text AS starts,s.ends_at::text AS ends,
        COALESCE(s.priority,0)::int AS priority,a.active,a.created_at AS "createdAt"
      FROM parish_private.announcement a
      LEFT JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
      WHERE a.active=TRUE ORDER BY a.id DESC LIMIT 100
    `
    const ids=rows.map(r=>r.id)
    const media=ids.length?await prisma.$queryRaw<MediaRow[]>`
      SELECT id,announcement_id AS "announcementId",object_path AS "objectPath",
        original_name AS "originalName",media_type AS "mediaType",mime_type AS "mimeType",
        size_bytes AS "sizeBytes",duration_seconds AS "durationSeconds",
        display_seconds AS "displaySeconds",sort_order AS "sortOrder"
      FROM parish_private.announcement_media
      WHERE announcement_id=ANY(${ids}::integer[])
      ORDER BY sort_order,id`: []
    return json({notices:formatNotices(rows,media),storageReady:studioConfigured()})
  }catch{return json({message:'Notice studio is unavailable. Apply its reviewed database migration first.'},503)}
}
export async function POST(req:NextRequest){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  const parsed=parseNotice(await req.json().catch(()=>null))
  if(!parsed)return json({message:'Enter a title, body, publication start/end, and a valid event date. Maximum publication period: 366 days.'},400)
  try{
    const id=await prisma.$transaction(async tx=>{
      const [row]=await tx.$queryRaw<{id:number}[]>`
        INSERT INTO parish_private.announcement(title,body,category,announcement_date,active)
        VALUES(${parsed.title},${parsed.body},${parsed.category},${parsed.date},TRUE)
        RETURNING id
      `
      await tx.$executeRaw`
        INSERT INTO parish_private.announcement_slide(announcement_id,priority,starts_at,ends_at,image_path)
        VALUES(${row.id},${parsed.priority},${parsed.starts}::date,${parsed.ends}::date,NULL)
      `
      await tx.$executeRaw`
        INSERT INTO parish_private.audit_log("user",action,created_at)
        VALUES(${actor!.email},${'Created announcement #'+row.id},now())
      `
      return row.id
    })
    return json({created:true,id},201)
  }catch{return json({message:'Could not create announcement. Check the notice studio migration.'},503)}
}
