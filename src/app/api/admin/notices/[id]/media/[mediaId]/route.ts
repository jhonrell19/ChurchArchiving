import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {getCurrentUser} from '@/lib/auth'
import {isSupervisor} from '@/lib/portalConfig'
import {removeObject} from '@/lib/noticeStudio'
export const runtime='nodejs'
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string;mediaId:string}>}){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return NextResponse.json({message:'Super Admin required'},{status:403})
  const {id,mediaId}=await params
  const noticeId=Number(id)
  let mediaKey:bigint
  try{mediaKey=BigInt(mediaId)}catch{return NextResponse.json({message:'Invalid media item'},{status:400})}
  if(!Number.isSafeInteger(noticeId)||noticeId<=0||mediaKey<=0n)return NextResponse.json({message:'Invalid media item'},{status:400})
  try{
    const [item]=await prisma.$queryRaw<{path:string}[]>`
      SELECT object_path AS path FROM parish_private.announcement_media
      WHERE id=${mediaKey} AND announcement_id=${noticeId}
    `
    if(!item)return NextResponse.json({message:'Media item missing'},{status:404})
    await removeObject(item.path)
    await prisma.$executeRaw`DELETE FROM parish_private.announcement_media WHERE id=${mediaKey} AND announcement_id=${noticeId}`
    return NextResponse.json({removed:true})
  }catch{return NextResponse.json({message:'Removal failed. Try again.'},{status:503})}
}
