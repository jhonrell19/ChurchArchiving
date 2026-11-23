import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {getCurrentUser} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {isSupervisor} from '@/lib/portalConfig'
import {notificationFeatureEnabled} from '@/lib/statusNotifications'

export const runtime='nodejs'
const json=(d:object,status=200)=>NextResponse.json(d,{status,headers:{'Cache-Control':'no-store'}})
export async function POST(_:NextRequest,{params}:{params:Promise<{id:string}>}){
  const actor=await getCurrentUser()
  if(!isSupervisor(actor))return json({message:'Super Admin required'},403)
  if(!notificationFeatureEnabled())return json({message:'Configure PARISH_STATUS_NOTIFICATIONS first.'},503)
  const id=Number((await params).id)
  if(!Number.isSafeInteger(id)||id<=0)return json({message:'Invalid notice'},400)
  try{
    const [notice]=await prisma.$queryRaw<{title:string}[]>`
      SELECT a.title FROM parish_private.announcement a
      JOIN parish_private.announcement_slide s ON s.announcement_id=a.id
      WHERE a.id=${id} AND a.active=TRUE
        AND s.starts_at <= (now() AT TIME ZONE 'Asia/Manila')::date
        AND s.ends_at >= (now() AT TIME ZONE 'Asia/Manila')::date
    `
    if(!notice)return json({message:'Only a currently published announcement can notify parishioners.'},409)
    let last=0,queued=0,eligible=0
    const message='Smart Parish: New parish announcement "'+notice.title.slice(0,95)+'". Sign in and check the parish calendar for details.'
    for(let round=0;round<20;round++){
      const subscribers=await prisma.notificationPreference.findMany({
        where:{
          userId:{gt:last},
          OR:[{announcementEmail:true},{announcementSms:true}],
          user:{is:{role:'USER',membershipStatus:'approved',emailVerified:true,accountEnabled:true}},
        },
        orderBy:{userId:'asc'},take:250,select:{userId:true},
      })
      if(!subscribers.length)break
      last=subscribers[subscribers.length-1].userId
      const rows=subscribers.map(sub=>({
        userId:sub.userId,requestId:0,office:'public',
        kind:'announcement:'+id,message,
        eventKey:createHash('sha256').update(`announcement:${id}:${sub.userId}`).digest('hex'),
      }))
      const created=await prisma.notificationEvent.createMany({data:rows,skipDuplicates:true})
      queued+=created.count
      eligible+=subscribers.length
      if(subscribers.length<250)break
    }
    await prisma.$executeRaw`
      INSERT INTO parish_private.audit_log("user",action,created_at)
      VALUES(${actor!.email},${'Queued notification for notice #'+id+' to '+queued+' opted-in account(s)'},now())
    `
    return json({queued,eligible,alreadyQueued:eligible-queued,
      message:'Alerts are queued, not yet sent. Use the delivery queue to submit approved messages.'})
  }catch{return json({message:'Could not queue announcement alerts. Confirm migration and recipient preferences.'},503)}
}
