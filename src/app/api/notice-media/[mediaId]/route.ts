import { NextRequest, NextResponse } from 'next/server'
import {prisma} from '@/lib/prisma'
import {fetchObject} from '@/lib/noticeStudio'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest,{params}:{params:Promise<{mediaId:string}>}){
  let key:bigint
  try{key=BigInt((await params).mediaId)}catch{return new NextResponse(null,{status:404})}
  if(key<=0n)return new NextResponse(null,{status:404})
  try{
    const [row]=await prisma.$queryRaw<{path:string;mime:string}[]>`
      SELECT m.object_path AS path,m.mime_type AS mime
      FROM parish_private.announcement_media m
      JOIN parish_private.announcement a ON a.id=m.announcement_id
      JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
      WHERE m.id=${key} AND a.active=TRUE
        AND s.starts_at <= (now() AT TIME ZONE 'Asia/Manila')::date
        AND s.ends_at >= (now() AT TIME ZONE 'Asia/Manila')::date
    `
    if(!row)return new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}})
    const range=req.headers.get('range')
    if(range&&!/^bytes=\d{0,10}-\d{0,10}$/.test(range))return new NextResponse(null,{status:416})
    const upstream=await fetchObject(row.path,range)
    const headers=new Headers({
      'Content-Type':row.mime,'Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'Cross-Origin-Resource-Policy':'same-origin',
      'Accept-Ranges':'bytes',
    })
    for(const key of ['content-range','content-length']) {
      const value=upstream.headers.get(key)
      if(value)headers.set(key,value)
    }
    return new NextResponse(upstream.body,{status:upstream.status===206?206:200,headers})
  }catch{return new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}})}
}
