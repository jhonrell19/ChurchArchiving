import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type PublicNotice = { id:number;title:string;body:string;category:string|null;date:string|null }
const headers = { 'Cache-Control':'public, max-age=0, s-maxage=60', 'X-Content-Type-Options':'nosniff' }
export async function GET() {
  try {
    const [{ slidesAvailable }] = await prisma.$queryRaw<{ slidesAvailable: boolean }[]> `
      SELECT to_regclass('parish_private.announcement_slide') IS NOT NULL AS "slidesAvailable"
    `
    const notices = slidesAvailable
      ? await prisma.$queryRaw<PublicNotice[]>`
          SELECT DISTINCT ON (a.id) a.id, a.title, a.body, a.category,
                 a.announcement_date AS date
            FROM parish_private.announcement a
            LEFT JOIN parish_private.announcement_slide s ON s.announcement_id = a.id
           WHERE a.active = TRUE
             AND (s.starts_at IS NULL OR s.starts_at <= (now() AT TIME ZONE 'Asia/Manila')::date)
             AND (s.ends_at IS NULL OR s.ends_at >= (now() AT TIME ZONE 'Asia/Manila')::date)
           ORDER BY a.id DESC LIMIT 5
        `
      : await prisma.$queryRaw<PublicNotice[]>`
          SELECT a.id, a.title, a.body, a.category, a.announcement_date AS date
            FROM parish_private.announcement a
           WHERE a.active = TRUE
           ORDER BY a.id DESC LIMIT 5
        `
    return NextResponse.json({notices}, {headers})
  } catch {
    return NextResponse.json({notices:[],message:'Parish announcements are temporarily unavailable.'},
      {status:503,headers:{'Cache-Control':'no-store'}})
  }
}
