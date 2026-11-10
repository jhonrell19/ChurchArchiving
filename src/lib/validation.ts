import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PH_PHONE_RE = /^09\d{9}$/
export const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ.'\- ]{2,80}$/

export function normalizeEmail(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : ''
}

export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return ''

  let phone = value
    .trim()
    .replace(/[\s()\-]/g, '')

  if (phone.startsWith('+63')) {
    phone = `0${phone.slice(3)}`
  } else if (phone.startsWith('63') && phone.length === 12) {
    phone = `0${phone.slice(2)}`
  }

  return phone
}


export function toE164PhilippinePhone(value: unknown) {
  const phone = normalizePhone(value)

  if (!PH_PHONE_RE.test(phone)) return ''

  return `+63${phone.slice(1)}`
}

export function validatePassword(password: string) {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('at least 12 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter')
  }
  if (!/\d/.test(password)) {
    errors.push('one number')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('one symbol')
  }

  return errors
}

export function cleanName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : ''
}

// Numbers are stored as E.164 for new registrations. libphonenumber-js/max
// validates country-specific number patterns, not simply character count.
// IMPORTANT: a valid pattern does not prove number ownership or reachability.
export function validateInternationalPhone(value: unknown, country: unknown) {
  if (typeof value !== 'string' || typeof country !== 'string') return ''
  const raw = value.trim()
  const code = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || !raw || raw.length > 40) return ''
  try {
    const parsed = parsePhoneNumberFromString(raw, code as CountryCode)
    if (!parsed || !parsed.isValid() || !parsed.country) return ''
    if (parsed.country !== code) return ''
    // Enforce mobile for PH, where the parish needs a reachable mobile contact.
    if (code === 'PH' && parsed.getType() !== 'MOBILE') return ''
    return parsed.number
  } catch {
    return ''
  }
}
