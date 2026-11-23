import {NextResponse} from 'next/server'
import {publicNotices} from '@/lib/noticeStudio'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  try{
    const notices=await publicNotices(25)
    return NextResponse.json({notices},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
  }catch{
    return NextResponse.json({message:'Announcements are temporarily unavailable.',notices:[]},
      {status:503,headers:{'Cache-Control':'no-store'}})
  }
}
