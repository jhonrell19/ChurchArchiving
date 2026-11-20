import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evidenceEnabled } from '@/lib/membershipEvidence'

export async function GET(_: Request, {params}: {params: Promise<{id:string}>}) {
  const actor = await getCurrentUser()
  if (!evidenceEnabled() || actor?.role !== 'ADMIN') return new Response(null,{status:403})
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id<1) return new Response(null,{status:400})
  const rows = await prisma.$queryRaw<{ image:Uint8Array }[]>`SELECT e.image FROM parish_auth.membership_evidence e
    JOIN parish_auth."User" u ON u.id=e.user_id WHERE e.user_id=${id} AND u."membershipStatus"='pending'`
  if (!rows.length) return new Response(null,{status:404})
  return new Response(new Uint8Array(rows[0].image), { headers: { 'Content-Type':'image/jpeg','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox" } })
}
