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

  if (password.length < 8) {
    errors.push('at least 8 characters')
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

  return errors
}

export function cleanName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : ''
}
