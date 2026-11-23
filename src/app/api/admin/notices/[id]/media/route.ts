import { NextRequest,NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { inspectMedia,newObjectPath,removeObject,studioConfigured,uploadObject } from '@/lib/noticeStudio'

export const runtime='nodejs'
type Context={params:Promise<{id:string}>}
const json=(d:object,status=200)=>NextResponse.json(d,{status,headers:{'Cache-Control':'no-store'}})
export async function POST(req:NextRequest,ctx:Context) {
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  const id=Number((await ctx.params).id)
  if(!Number.isSafeInteger(id)||id<=0)return json({message:'Invalid announcement'},400)
  if(!studioConfigured())return json({message:'Configure the private announcement storage on the web service.'},503)
  const statedLength=Number(req.headers.get('content-length')||0)
  if(statedLength>19*1024*1024)return json({message:'Upload too large. Video: 18 MB; images: 5 MB.'},413)
  let form:FormData
  try{form=await req.formData()}catch{return json({message:'Invalid upload request.'},400)}
  const uploaded=form.get('file')
  if(!(uploaded instanceof File))return json({message:'Choose a picture or short MP4 video.'},400)
  if(uploaded.size>18*1024*1024||!uploaded.size)return json({message:'File must not exceed 18 MB.'},413)
  let result:ReturnType<typeof inspectMedia>
  let buffer:Buffer
  try{
    buffer=Buffer.from(await uploaded.arrayBuffer())
    result=inspectMedia(buffer,uploaded.type)
  }catch(err){return json({message:err instanceof Error?err.message:'Invalid media content.'},400)}
  const seconds=Number(form.get('displaySeconds')||8)
  if(!Number.isSafeInteger(seconds)||seconds<5||seconds>30)
    return json({message:'Photo display time must be 5–30 seconds.'},400)
  const sort=Number(form.get('sortOrder')||0)
  if(!Number.isInteger(sort)||sort<0||sort>100)return json({message:'Invalid media order'},400)
  const [notice]=await prisma.$queryRaw<{id:number}[]>`
    SELECT id FROM parish_private.announcement WHERE id=${id} AND active=TRUE
  `
  if(!notice)return json({message:'Announcement unavailable'},404)
  const existing=await prisma.$queryRaw<{images:number;videos:number;total:number}[]>`
    SELECT COUNT(*) FILTER(WHERE media_type='image')::int AS images,
      COUNT(*) FILTER(WHERE media_type='video')::int AS videos,
      COALESCE(SUM(size_bytes),0)::int AS total
    FROM parish_private.announcement_media WHERE announcement_id=${id}
  `
  const previous=existing[0]
  if((result.kind==='image'&&previous.images>=4)||(result.kind==='video'&&previous.videos>=1)||
      previous.total+buffer.length>24*1024*1024)
    return json({message:'Each announcement permits four pictures and one clip, up to 24 MB total.'},409)
  const path=newObjectPath(id,result.mime)
  let uploadedToStorage=false
  try{
    await uploadObject(path,buffer,result.mime)
    uploadedToStorage=true
    const [row]=await prisma.$queryRaw<{id:bigint}[]>`
      INSERT INTO parish_private.announcement_media(
        announcement_id,object_path,original_name,media_type,mime_type,size_bytes,
        duration_seconds,display_seconds,sort_order
      ) VALUES (
        ${id},${path},${uploaded.name.slice(0,160)},${result.kind},${result.mime},
        ${buffer.length},${result.seconds},${result.kind==='video'?Math.ceil(result.seconds||8):seconds},${sort}
      ) RETURNING id
    `
    return json({uploaded:true,id:String(row.id),type:result.kind,seconds:result.seconds},201)
  }catch{
    if(uploadedToStorage)await removeObject(path).catch(()=>undefined)
    return json({message:'Upload failed. No media attachment was added.'},503)
  }
}
