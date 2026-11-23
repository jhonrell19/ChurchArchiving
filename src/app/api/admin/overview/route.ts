import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isSupervisor } from '@/lib/portalConfig'

export const dynamic = 'force-dynamic'
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
    return NextResponse.json({ parishioners, staff, disabledStaff }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ message: 'Overview unavailable' }, { status: 503 })
  }
}
