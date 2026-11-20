import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor, portalEnabled, readPolicy } from '@/lib/portalConfig'
const headers={'Cache-Control':'no-store'}
export async function GET() {
  if(!portalEnabled()) return NextResponse.json({enabled:false},{headers})
  const [policy,items]=await Promise.all([readPolicy(), prisma.$queryRaw<{category:string,choices:string[]}[]>`SELECT category,choices FROM parish_private.purpose_catalog`])
  return NextResponse.json({enabled:true,policy,purposes:Object.fromEntries(items.map(r=>[r.category,r.choices]))},{headers})
}
export async function POST(req:Request) {
  const user=await getCurrentUser()
  if(!portalEnabled()||!user||!isSupervisor(user))return NextResponse.json({error:'Forbidden'},{status:403})
  const body=await req.json().catch(()=>null)
  if(typeof body?.policy==='string' && body.policy.trim().length>=20 && body.policy.length<=20000){
    await prisma.$executeRaw`INSERT INTO parish_private.policy_version(body,changed_by) VALUES(${body.policy.trim()},${user.id})`
  }else if(['baptismal','confirmation','marriage','ownership','land_agreement'].includes(body?.category)
    && Array.isArray(body.choices) && body.choices.length>0 && body.choices.length<=40 && body.choices.every((v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=100&&!v.includes('|'))){
    const choices=Array.from(new Set(body.choices.map((v:string)=>v.trim())))
    await prisma.$executeRaw`UPDATE parish_private.purpose_catalog SET choices=${JSON.stringify(choices)}::jsonb,
      changed_by=${user.id},changed_at=now() WHERE category=${body.category}`
  }else return NextResponse.json({error:'Check the policy length or purpose choices.'},{status:400})
  return NextResponse.json({ok:true},{headers})
}
