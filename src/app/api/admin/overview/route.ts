import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'

export const dynamic = 'force-dynamic'
type MonthPoint = {month:string;total:number}
const emptyMonths:MonthPoint[] = []

export async function GET() {
  const actor = await getCurrentUser()
  if (!isSupervisor(actor))
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  try {
    const [parishioners, staff, disabledStaff] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: { in: ['STAFF', 'BURIAL_ADMIN'] } } }),
      prisma.user.count({ where: { role: { in: ['STAFF', 'BURIAL_ADMIN'] }, accountEnabled: false } }),
    ])
    // Legacy burial tables can be absent on some evaluation installs.
    // Return a partial overview rather than making the entire dashboard fail.
    const results = await Promise.allSettled([
      prisma.$queryRaw<{total:number}[]>`
        SELECT COUNT(*)::int AS total FROM parish_private.document
         WHERE active = TRUE AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
      `,
      prisma.$queryRaw<MonthPoint[]>`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS total
          FROM parish_private.certificate_request
         WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '5 months')
         GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<MonthPoint[]>`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS total
          FROM parish_private.burial_record
         WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '5 months')
         GROUP BY 1 ORDER BY 1
      `,
    ])
    const newUploads = results[0].status === 'fulfilled' ? results[0].value[0]?.total ?? 0 : null
    const requestsByMonth = results[1].status === 'fulfilled' ? results[1].value : emptyMonths
    const burialsByMonth = results[2].status === 'fulfilled' ? results[2].value : emptyMonths
    return NextResponse.json({
      parishioners, staff, disabledStaff, newUploads, requestsByMonth, burialsByMonth,
      burialsAvailable: results[2].status === 'fulfilled',
    },{headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ message: 'Overview unavailable' }, { status: 503 })
  }
}
