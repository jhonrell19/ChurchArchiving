import 'server-only'

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export type NoticeRow = {
  id:number; title:string; body:string; category:string|null;
  date:string|null; starts:string|null; ends:string|null; priority:number;
  active:boolean; createdAt:Date
}
export type MediaRow = {
  id:bigint; announcementId:number; objectPath:string; originalName:string;
  mediaType:'image'|'video'; mimeType:string; sizeBytes:number;
  durationSeconds:number|null; displaySeconds:number; sortOrder:number;
}
export function studioConfigured() {
  return !!(process.env.PARISH_SUPABASE_URL && process.env.PARISH_SUPABASE_SERVICE_ROLE_KEY)
}
function storageConfig() {
  const base = (process.env.PARISH_SUPABASE_URL || '').replace(/\/$/,'')
  const url = new URL(base)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
      url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw Error('Invalid private Storage project URL')
  }
  const key=process.env.PARISH_SUPABASE_SERVICE_ROLE_KEY || ''
  if(key.length<32)throw Error('Private storage service credential not configured')
  const bucket=process.env.PARISH_ANNOUNCEMENT_BUCKET || 'smart-parish-private'
  if(!/^[a-z0-9][a-z0-9_-]{2,62}$/.test(bucket))throw Error('Invalid storage bucket')
  return {base,key,bucket}
}
function objectUrl(path:string, authenticated=false){
  if(!/^notices\/\d+\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp|mp4)$/.test(path))
    throw Error('Invalid announcement media path')
  const {base,key,bucket}=storageConfig()
  return {
    url:`${base}/storage/v1/object/${authenticated?'authenticated/':''}${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,
    key,base,bucket,
  }
}
export async function uploadObject(path:string,data:Buffer,mime:string) {
  const {url,key}=objectUrl(path)
  const response=await fetch(url,{method:'POST',headers:{
    apikey:key,Authorization:`Bearer ${key}`,'Content-Type':mime,
    'x-upsert':'false','cache-control':'no-store',
  },body:new Uint8Array(data),signal:AbortSignal.timeout(25000),cache:'no-store'})
  if(!response.ok)throw Error('Storage upload failed (HTTP '+response.status+')')
}
export async function removeObject(path:string) {
  const {base,key,bucket}=objectUrl(path)
  const response=await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`,{
    method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({prefixes:[path]}),cache:'no-store',signal:AbortSignal.timeout(20000),
  })
  if(!response.ok)throw Error('Storage removal failed (HTTP '+response.status+')')
}
export async function fetchObject(path:string, range?:string|null) {
  const {url,key}=objectUrl(path,true)
  const response=await fetch(url,{
    method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`,...(range?{Range:range}:{})},
    cache:'no-store',signal:AbortSignal.timeout(30000),
  })
  if(!response.ok)throw Error('Announcement media temporarily unavailable')
  return response
}
const imageLimits:Record<string,number>={'image/jpeg':5*1024*1024,'image/png':5*1024*1024,'image/webp':5*1024*1024}
const maxClip=18*1024*1024
function signatureType(bytes:Buffer):string|null{
  if(bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff)return 'image/jpeg'
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png'
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp'
  if(bytes.length>=16 && bytes.toString('ascii',4,8)==='ftyp')return 'video/mp4'
  return null
}
function movieDuration(buf:Buffer):number|null {
  // MP4 movie header's declared duration. Reject malformed/fragmented files.
  function scan(start:number,end:number,depth:number):number|null {
    let offset=start
    while(offset+8<=end){
      let size=buf.readUInt32BE(offset)
      const type=buf.toString('ascii',offset+4,offset+8)
      let header=8
      if(size===1){
        if(offset+16>end)return null
        const wide=buf.readBigUInt64BE(offset+8)
        if(wide>BigInt(buf.length))return null
        size=Number(wide);header=16
      }else if(size===0)size=end-offset
      if(size<header||offset+size>end)return null
      if(type==='moov'&&depth===0)return scan(offset+header,offset+size,1)
      if(type==='mvhd'&&depth===1){
        const base=offset+header
        if(base+36>offset+size)return null
        const version=buf[base]
        const timescaleOffset=base+(version===1?20:12)
        const durationOffset=base+(version===1?24:16)
        if(durationOffset+(version===1?8:4)>offset+size)return null
        const timescale=buf.readUInt32BE(timescaleOffset)
        if(!timescale)return null
        const ticks=version===1?Number(buf.readBigUInt64BE(durationOffset)):buf.readUInt32BE(durationOffset)
        const seconds=ticks/timescale
        return Number.isFinite(seconds)&&seconds>0?seconds:null
      }
      offset+=size
    }
    return null
  }
  return scan(0,buf.length,0)
}
export function inspectMedia(bytes:Buffer,declaredType:string) {
  const detected=signatureType(bytes)
  if(!detected||detected!==declaredType)throw Error('File type did not match the image or MP4 content.')
  const limit=imageLimits[detected]||maxClip
  if(bytes.length===0||bytes.length>limit)throw Error(detected==='video/mp4'?'MP4 clips must be under 18 MB.':'Pictures must be under 5 MB.')
  const seconds=detected==='video/mp4'?movieDuration(bytes):null
  if(detected==='video/mp4'&&(!seconds||seconds>30))throw Error('MP4 clip must have a readable duration of at most 30 seconds.')
  return {kind:detected==='video/mp4'?'video' as const:'image' as const,mime:detected,seconds}
}
export function newObjectPath(id:number,mime:string) {
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4'}
  if(!ext[mime])throw Error('Invalid media type')
  return `notices/${id}/${randomUUID()}.${ext[mime]}`
}
export function isISODate(s:unknown):s is string {
  if(typeof s!=='string'||!/^(20\d\d)-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s))return false
  const date=new Date(s+'T12:00:00Z')
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s
}
export function formatNotices(rows:NoticeRow[],media:MediaRow[]){
  return rows.map(row=>({
    ...row,createdAt:row.createdAt?.toISOString?.()||null,
    media:media.filter(m=>m.announcementId===row.id).map(m=>({
      id:String(m.id),type:m.mediaType,mime:m.mimeType,displaySeconds:m.displaySeconds,
      durationSeconds:m.durationSeconds===null?null:Number(m.durationSeconds),
      bytes:m.sizeBytes,name:m.originalName,url:`/api/notice-media/${m.id}`,
    })),
  }))
}
export async function publicNotices(limit=15){
  const rows=await prisma.$queryRaw<NoticeRow[]>`
    SELECT a.id,a.title,a.body,a.category,a.announcement_date AS date,
      s.starts_at::text AS starts,s.ends_at::text AS ends,
      COALESCE(s.priority,0)::int AS priority,a.active,a.created_at AS "createdAt"
    FROM parish_private.announcement a
    LEFT JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
    WHERE a.active=TRUE
      AND (s.starts_at IS NULL OR s.starts_at <= (now() AT TIME ZONE 'Asia/Manila')::date)
      AND (s.ends_at IS NULL OR s.ends_at >= (now() AT TIME ZONE 'Asia/Manila')::date)
    ORDER BY COALESCE(s.priority,0) DESC,a.id DESC
    LIMIT ${limit}
  `
  const ids=rows.map(row=>row.id)
  if(!ids.length)return []
  const media=await prisma.$queryRaw<MediaRow[]>`
    SELECT id,announcement_id AS "announcementId",object_path AS "objectPath",
      original_name AS "originalName",media_type AS "mediaType",mime_type AS "mimeType",
      size_bytes AS "sizeBytes",duration_seconds AS "durationSeconds",
      display_seconds AS "displaySeconds",sort_order AS "sortOrder"
    FROM parish_private.announcement_media
    WHERE announcement_id=ANY(${ids}::integer[])
    ORDER BY sort_order,id
  `
  return formatNotices(rows,media)
}

const noticeCategories=['Event','Schedule','Ministry','Sacrament','Public calendar notice','General']
export function parseNotice(data:any){
  if(!data||typeof data!=='object')return null
  const title=typeof data.title==='string'?data.title.trim():''
  const body=typeof data.body==='string'?data.body.trim():''
  const category=typeof data.category==='string'?data.category:'Event'
  const starts=data.starts
  const ends=data.ends
  const date=data.date||null
  const priority=Number(data.priority||0)
  if(!title||title.length>180||!body||body.length>2000||!noticeCategories.includes(category)||
     !isISODate(starts)||!isISODate(ends)||starts>ends||(date!==null&&!isISODate(date))||
     !Number.isSafeInteger(priority)||priority< -100||priority>100)return null
  const startDate=new Date(starts+'T12:00:00Z')
  const endDate=new Date(ends+'T12:00:00Z')
  if(endDate.getTime()-startDate.getTime()>366*86400000)return null
  return {title,body,category,starts,ends,date,priority}
}

/** Explicit origin protection for cookie-authenticated notice mutations. */
export function noticeMutationIsSameOrigin(req:Request){
  const origin=req.headers.get('origin')
  const configured=process.env.APP_BASE_URL?.replace(/\/$/,'')
  const expected=process.env.NODE_ENV==='production' ? configured : new URL(req.url).origin
  return Boolean(origin&&expected&&origin===expected)
}
