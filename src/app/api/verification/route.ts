import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { evidenceUserId } from '@/lib/membershipEvidence'

function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
export async function GET(req: NextRequest) {
  const id = evidenceUserId(req)
  if (!id) return reply('Sign in again to access membership verification.', 401)
  const rows = await prisma.$queryRaw<{ submitted: boolean, status: string }[]>`
    SELECT u."membershipStatus" AS status, e.user_id IS NOT NULL AS submitted
    FROM parish_auth."User" u LEFT JOIN parish_auth.membership_evidence e ON e.user_id=u.id
    WHERE u.id=${id} AND u.role='USER' AND u."emailVerified"`
  if (!rows.length) return reply('Account unavailable.', 403)
  return NextResponse.json(rows[0], { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  const id = evidenceUserId(req)
  if (!id) return reply('Sign in again to submit evidence.', 401)
  const origin = req.headers.get('origin')
  if (!origin || (origin !== new URL(req.url).origin && origin !== process.env.APP_BASE_URL?.replace(/\/$/, ''))) return reply('Invalid origin.', 403)
  let hint: string
  try { hint = decodeURIComponent(req.headers.get('x-parish-record') || '').trim() } catch { return reply('Invalid record reference.', 400) }
  if (hint.length < 3 || hint.length > 160) return reply('Provide a record reference or name and year.', 400)
  if (!['image/jpeg', 'image/png'].includes(req.headers.get('content-type') || '')) return reply('Choose a JPEG or PNG.', 415)
  const limit = 3 * 1024 * 1024
  const reader = req.body?.getReader()
  if (!reader) return reply('Select an image.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.length
    if (size > limit) { await reader.cancel(); return reply('Image must be at most 3 MB.', 413) }
    chunks.push(part.value)
  }
  let image: Buffer
  try {
    const input = sharp(Buffer.concat(chunks), { limitInputPixels: 20000000, failOn: 'error' })
    const metadata = await input.metadata()
    if (!['jpeg','png'].includes(metadata.format || '')) return reply('Choose a JPEG or PNG.', 415)
    image = await input.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer()
  } catch { return reply('Image could not be read. Choose a smaller JPEG or PNG.', 400) }
  if (image.length > 1048576) return reply('Select a smaller image.', 413)
  const changed = await prisma.$transaction(async tx => {
    const users = await tx.$queryRaw<{id:number}[]>`SELECT id FROM parish_auth."User" WHERE id=${id} AND role='USER'
      AND "emailVerified" AND "membershipStatus"='pending' FOR UPDATE`
    if (!users.length) return false
    return (await tx.$executeRaw`INSERT INTO parish_auth.membership_evidence(user_id,image,record_hint)
      VALUES (${id},${image},${hint}) ON CONFLICT(user_id) DO NOTHING`) === 1
  })
  return changed ? reply('Evidence submitted for parish review.', 201) : reply('Evidence already submitted or review completed.', 409)
}
