import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email'

import { evidenceEnabled } from '@/lib/membershipEvidence'

const cache = { 'Cache-Control': 'no-store' }

async function authorized() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

// Main Admin only; deliberately no public mutation route.
export async function GET(req: NextRequest) {
  const actor = await authorized()
  if (!actor) return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: cache })
  const page = Number(req.nextUrl.searchParams.get("page") || 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return NextResponse.json({message:"Invalid page"},{status:400})
  const users = await prisma.user.findMany({
    where: { role: 'USER', membershipStatus: 'pending' },
    select: { id: true, firstName: true, middleName: true, surname: true,
      email: true, emailVerified: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: (page-1)*20, take: 21,
  })
  const listed = users.slice(0,20)
  const enabled = evidenceEnabled()
  const evidence = enabled && listed.length ? await prisma.$queryRaw<{user_id:number,record_hint:string}[]>`
    SELECT user_id,record_hint FROM parish_auth.membership_evidence WHERE user_id = ANY(${listed.map(u => u.id)}::integer[])` : []
  return NextResponse.json({ hasNext: users.length>20, evidenceEnabled:enabled,
    users: listed.map(u => ({...u, evidenceHint:evidence.find(e=>e.user_id===u.id)?.record_hint || null})) }, { headers: cache })
}

export async function POST(req: NextRequest) {
  const actor = await authorized()
  if (!actor) return NextResponse.json({ message: 'Forbidden' }, { status: 403, headers: cache })

  // Explicit same-origin check in addition to SameSite cookies.
  const origin = req.headers.get('origin')
  const publicOrigin = process.env.APP_BASE_URL?.replace(/\/$/, '')
  const allowed = process.env.NODE_ENV === 'production' ? [publicOrigin] : [publicOrigin, new URL(req.url).origin]
  if (!origin || !allowed.includes(origin)) {
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

  const enabled = evidenceEnabled()
  const certificate = typeof body?.certificateNumber === 'string' ? body.certificateNumber.trim() : ''
  if (enabled && decision === 'approved' && (!certificate || certificate.length>100 || body?.checked !== true)) {
    return NextResponse.json({ message:'Review the ID and provide its matching baptismal certificate number.' },{status:400})
  }
  const update = await prisma.$transaction(async tx => {
    const applicant = await tx.$queryRaw<{id:number}[]>`SELECT id FROM parish_auth."User" WHERE id=${id}
      AND role='USER' AND "emailVerified" AND "membershipStatus"='pending' FOR UPDATE`
    if (!applicant.length) return {count:0}
    if (enabled) {
      let matchedId: number | null = null
      if (decision === 'approved') {
        const matches = await tx.$queryRaw<{id:number}[]>`SELECT id FROM parish_private.document
          WHERE active AND sacrament_type='baptismal' AND certificate_number=${certificate} LIMIT 2 FOR SHARE`
        if (matches.length !== 1) return {count:0}
        matchedId = matches[0].id
      }
      const evidenceRows = await tx.$executeRaw`UPDATE parish_auth.membership_evidence SET
        matched_document_id=${matchedId}, reviewed_by=${actor.id}, reviewed_at=now(),
        decision=${decision}, review_reason=${reason} WHERE user_id=${id} AND decision IS NULL`
      if (decision === 'approved' && !evidenceRows) return {count:0}
    }
    const update = await tx.user.updateMany({
    where: { id, role: 'USER', membershipStatus: 'pending', emailVerified: true },
    data: {
      membershipStatus: decision,
      membershipReviewedAt: new Date(),
      membershipReviewedById: actor.id,
      membershipReviewReason: reason,
    },
  })
    return update
  })
  if (update.count !== 1) {
    return NextResponse.json({ message: 'Check pending status, ID evidence and the exact baptismal certificate number.' }, { status: 409 })
  }
  // An account decision is an operational email, not an unsolicited SMS broadcast.
  // Queue/outbound failures never roll back a membership decision.
  try {
    if (isTransactionalEmailConfigured()) {
      const reviewed=await prisma.user.findUnique({
        where:{id},select:{email:true,emailVerified:true},
      })
      if (reviewed?.emailVerified) {
        const message=decision==='approved'
          ? 'Your Smart Parish membership was approved. You can now sign in and request certificates.'
          : 'Your Smart Parish membership application was reviewed and was not approved. Please contact the parish office for the reason and next steps.'
        await sendTransactionalEmail({
          to: reviewed.email,subject:'Smart Parish membership review',
          html:'<p>'+message+'</p><p>Only use the official Smart Parish website to review your account. Never share OTP codes.</p>',
        })
      }
    }
  } catch {
    console.warn('Membership email unavailable; membership decision remains saved.')
  }
  console.info('Parish membership reviewed', { memberId: id, actorId: actor.id, decision })
  return NextResponse.json({ success: true }, { headers: cache })
}
