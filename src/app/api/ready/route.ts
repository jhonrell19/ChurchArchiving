import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Probe = { ready: boolean; retry: number }
let pending: Promise<Probe> | undefined
let cached: Probe | undefined
let expires = 0

async function probe(): Promise<Probe> {
  const base = process.env.FLASK_API_URL
  const key = process.env.FLASK_INTERNAL_KEY
  if (!base || !key) {
    console.warn('Parish readiness: missing Flask connection settings')
    return { ready: false, retry: 30 }
  }
  let stage = 'Flask health request'
  try {
    const api = await fetch(new URL('/api/health', base), {
      headers: { 'X-Internal-Key': key, 'X-User-Role': 'USER', 'X-User-Id': '0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!api.ok) {
      console.warn('Parish readiness: Flask health HTTP', api.status)
      const raw = api.headers.get('retry-after')
      const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : 0
      return { ready: false, retry: seconds > 0 ? seconds : api.status === 429 ? 60 : 5 }
    }
    stage = 'archive database or unexpected Flask response'
    if ((await api.json()).database !== 'ok') throw new Error()
    stage = 'authentication database'
    await prisma.user.findFirst({ select: { id: true } })
    return { ready: true, retry: 0 }
  } catch {
    console.warn('Parish readiness failed:', stage)
    return { ready: false, retry: 5 }
  }
}

export async function GET() {
  if (!cached || expires <= Date.now()) {
    pending ??= probe().then(result => {
      cached = result
      expires = Date.now() + (result.ready ? 5 : result.retry) * 1000
      return result
    }).finally(() => { pending = undefined })
    await pending
  }
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  if (!cached?.ready) headers.set('Retry-After', String(Math.max(1, Math.ceil((expires - Date.now()) / 1000))))
  return new Response(cached?.ready ? 'ready' : 'unavailable', { status: cached?.ready ? 200 : 503, headers })
}
