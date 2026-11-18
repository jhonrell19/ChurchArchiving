import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const base = process.env.FLASK_API_URL
  const key = process.env.FLASK_INTERNAL_KEY
  try {
    if (!base || !key) throw new Error('Backend configuration missing')
    const [, api] = await Promise.all([
      prisma.user.findFirst({ select: { id: true } }),
      fetch(new URL('/api/health', base), {
        headers: { 'X-Internal-Key': key, 'X-User-Role': 'USER', 'X-User-Id': '0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
    ])
    if (!api.ok || (await api.json()).database !== 'ok') throw new Error('Archive unavailable')
    return new Response('ready', { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return new Response('unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
