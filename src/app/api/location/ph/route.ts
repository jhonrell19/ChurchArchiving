import { NextRequest, NextResponse } from 'next/server'

// An allowlisted, server-side directory proxy. No user-provided URL is fetched.
// Data provider: https://psgc.cloud/api-docs/v2 (public PSGC-based API).
export async function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get('level')
  const region = request.nextUrl.searchParams.get('region') || ''
  const province = request.nextUrl.searchParams.get('province') || ''
  const city = request.nextUrl.searchParams.get('city') || ''
  const safe = (value: string) => /^[A-Za-z0-9-]{1,30}$/.test(value)
  let path = ''
  if (level === 'regions') path = 'regions'
  if (level === 'provinces' && safe(region)) path = `regions/${region}/provinces`
  if (level === 'cities' && safe(province)) path = `provinces/${province}/cities-municipalities`
  if (level === 'cities' && !province && safe(region)) path = `regions/${region}/cities-municipalities`
  if (level === 'barangays' && safe(city)) path = `cities-municipalities/${city}/barangays`
  if (!path) return NextResponse.json({ message: 'Invalid location query.' }, { status: 400 })
  try {
    const response = await fetch(`https://psgc.cloud/api/v2/${path}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Location directory returned ${response.status}`)
    const data: unknown = await response.json()
    const source: unknown = Array.isArray(data) ? data :
      (data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : null)
    if (!Array.isArray(source)) throw new Error('Invalid directory response')
    const options = source.filter((item): item is {code:string; name:string} =>
      !!item && typeof item === 'object' && typeof item.code === 'string' && typeof item.name === 'string'
    ).map(item => ({ code: item.code, name: item.name }))
    return NextResponse.json({ options }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  } catch (error) {
    console.error('PH location directory error:', error)
    return NextResponse.json({ message: 'Location list is unavailable. Use the manual address fields instead.' }, { status: 503 })
  }
}
