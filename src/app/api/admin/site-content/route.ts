import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'
import { prisma } from '@/lib/prisma'
import { siteEditingEnabled } from '@/lib/publishedSiteContent'
import { validContent } from '@/lib/siteContent'

export async function POST(request:Request) {
  const actor=await getCurrentUser()
  if (!actor || !isSupervisor(actor)) return NextResponse.json({error:'Forbidden'},{status:403})
  if (!siteEditingEnabled()) return NextResponse.json({error:'Website editing is disabled.'},{status:503})
  const body=await request.json().catch(()=>null)
  if (!Number.isSafeInteger(body?.revision) || body.revision<0 || body.revision>=2147483647 || !validContent(body.content))
    return NextResponse.json({error:'Check the heading, description, photo and service times.'},{status:400})
  const revision=body.revision+1
  try {
    // An edition is append-only. Concurrent editors cannot overwrite each other.
    const inserted=await prisma.$executeRaw`INSERT INTO parish_private.site_edition (revision,content,published_by)
      SELECT ${revision}::integer,${JSON.stringify(body.content)}::jsonb,${actor.id}::integer
      WHERE ${body.revision}::integer = (SELECT COALESCE(max(revision),0) FROM parish_private.site_edition)
      ON CONFLICT (revision) DO NOTHING`
    if (!inserted) return NextResponse.json({error:'Another editor published first. Reload this page to review the current version.'},{status:409})
    return NextResponse.json({revision})
  } catch {
    console.error('Parish website edition publication failed')
    return NextResponse.json({error:'The changes could not be published. Your draft is still here.'},{status:503})
  }
}
