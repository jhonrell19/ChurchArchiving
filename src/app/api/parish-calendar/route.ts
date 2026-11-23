import {NextResponse} from 'next/server'
import {publicNotices} from '@/lib/noticeStudio'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  try{
    const notices=await publicNotices(100)
    return NextResponse.json({notices:notices.map(n=>({
      id:n.id,title:n.title,body:n.body,date:n.date||undefined,
      starts:n.starts||undefined,ends:n.ends||undefined,
    }))},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({message:'Parish calendar notices are temporarily unavailable.',notices:[]},
      {status:503,headers:{'Cache-Control':'no-store'}})
  }
}
