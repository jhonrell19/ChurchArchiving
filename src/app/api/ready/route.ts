import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function authReady() {
  try {
    await prisma.user.findFirst({ select: { id: true } })
    return true
  } catch {
    console.error('Readiness failed: authentication database')
    return false
  }
}

async function archiveReady() {
  const base = process.env.FLASK_API_URL
  const key = process.env.FLASK_INTERNAL_KEY
  if (!base || !key) {
    console.error('Readiness failed: Flask connection settings')
    return false
  }
  try {
    const api = await fetch(new URL('/api/health', base), {
      headers: { 'X-Internal-Key': key, 'X-User-Role': 'USER', 'X-User-Id': '0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    })
    if (!api.ok) {
      console.error('Readiness failed: Flask health HTTP', api.status)
      return false
    }
    if ((await api.json()).database === 'ok') return true
    console.error('Readiness failed: archive database health')
  } catch {
    console.error('Readiness failed: Flask health unreachable or invalid response')
  }
  return false
}

export async function GET() {
  const checks = await Promise.all([authReady(), archiveReady()])
  const ready = checks.every(Boolean)
  return new Response(ready ? 'ready' : 'unavailable', {
    status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' },
  })
}
