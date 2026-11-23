import {NextResponse} from 'next/server'
import {getCurrentUser} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {isSupervisor} from '@/lib/portalConfig'
import {noticeMutationIsSameOrigin} from '@/lib/noticeStudio'
import {flushPendingNotifications,notificationFeatureEnabled} from '@/lib/statusNotifications'
export const runtime='nodejs'
const json=(d:object,status=200)=>NextResponse.json(d,{status,headers:{'Cache-Control':'no-store'}})
async function allowed(){
  const actor=await getCurrentUser()
  return isSupervisor(actor)
}
export async function GET(){
  if(!await allowed())return json({message:'Super Admin required'},403)
  if(!notificationFeatureEnabled())return json({enabled:false,pending:0})
  try{
    const pending=await prisma.notificationEvent.count({
      where:{office:'public',OR:[{emailState:'pending'},{smsState:'pending'}]},
    })
    return json({enabled:true,pending})
  }catch{return json({message:'Announcement delivery queue not configured.'},503)}
}
export async function POST(req:Request){
  if(!await allowed())return json({message:'Super Admin required'},403)
  if(!noticeMutationIsSameOrigin(req))return json({message:'Invalid request origin'},403)
  if(!notificationFeatureEnabled())return json({message:'Notification outbox is disabled'},503)
  try{
    const result=await flushPendingNotifications('public',5)
    return json({...result,description:'Provider accepted is not delivered to recipient.'})
  }catch{return json({message:'Sending queue unavailable. Existing announcements remain published.'},503)}
}
