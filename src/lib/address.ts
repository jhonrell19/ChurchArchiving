import { getCountries } from 'libphonenumber-js/max'

const COUNTRIES = new Set<string>(getCountries())
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })

type AddressInfo = {
  country?: unknown
  region?: unknown
  province?: unknown
  city?: unknown
  barangay?: unknown
  postalCode?: unknown
  street?: unknown
}

// Ignore forged address strings: only the structured fields are accepted.
// Validation here does not verify the physical existence of a mailing address.
export function validateAndFormatAddress(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const body = input as AddressInfo
  const get = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : ''
  const country = get(body.country).toUpperCase()
  const region = get(body.region)
  const province = get(body.province)
  const city = get(body.city)
  const barangay = get(body.barangay)
  const postalCode = get(body.postalCode)
  const street = get(body.street)
  if (!COUNTRIES.has(country)) return ''
  if (region.length < 2 || region.length > 100 || city.length < 2 || city.length > 100) return ''
  if (street.length > 150 || province.length > 100 || barangay.length > 100) return ''
  if (country === 'PH') {
    if (postalCode && !/^\d{4}$/.test(postalCode)) return ''
    if (barangay.length < 2) return ''
  } else if (postalCode && !/^[\p{L}\d -]{2,15}$/u.test(postalCode)) return ''
  const address = [street,barangay,city,province,region,postalCode,countryNames.of(country)||country].filter(Boolean).join(', ')
  return address.length >= 8 && address.length <= 500 ? address : ''
}
