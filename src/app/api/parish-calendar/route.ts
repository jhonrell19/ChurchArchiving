import { NextResponse } from 'next/server'

export async function GET() {
  const base = process.env.FLASK_API_URL
  const key = process.env.FLASK_INTERNAL_KEY
  try {
    if (!base || !key) throw Error()
    const response = await fetch(base.replace(/\/$/, '') + '/api/public/calendar', {
      headers: { 'X-Internal-Key': key, 'X-User-Role': 'PUBLIC_CALENDAR' },
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw Error()
    return NextResponse.json(await response.json(), {headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({message:'Parish notices are temporarily unavailable.'}, {status:503})
  }
}
