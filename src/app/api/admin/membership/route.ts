import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const cache = { 'Cache-Control': 'no-store' }

async function authorized() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

// Main Admin only; deliberately no public mutation route.
export async function GET() {
  const actor = await authorized()
  if (!actor) return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: cache })
  const users = await prisma.user.findMany({
    where: { role: 'USER', membershipStatus: 'pending' },
    select: { id: true, firstName: true, middleName: true, surname: true,
      email: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  return NextResponse.json({ users }, { headers: cache })
}

export async function POST(req: NextRequest) {
  const actor = await authorized()
  if (!actor) return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: cache })

  // Explicit same-origin check in addition to SameSite cookies.
  if (req.headers.get('origin') !== new URL(req.url).origin) {
    return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const id = Number(body?.userId)
  const decision = body?.decision
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!Number.isSafeInteger(id) || id <= 0 || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ message: 'Invalid member or decision' }, { status: 400 })
  }
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ message: 'A review reason (5–500 characters) is required' }, { status: 400 })
  }

  const update = await prisma.user.updateMany({
    where: { id, role: 'USER', membershipStatus: 'pending', emailVerified: true },
    data: {
      membershipStatus: decision,
      membershipReviewedAt: new Date(),
      membershipReviewedById: actor.id,
      membershipReviewReason: reason,
    },
  })
  if (update.count !== 1) {
    return NextResponse.json({ message: 'Member must exist, have a verified email, and still be pending' }, { status: 409 })
  }
  console.info('Parish membership reviewed', { memberId: id, actorId: actor.id, decision })
  return NextResponse.json({ success: true }, { headers: cache })
}
