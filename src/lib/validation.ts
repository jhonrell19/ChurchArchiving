export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PH_PHONE_RE = /^(?:\+63|0)9\d{9}$/
export const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ.'\- ]{2,80}$/

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normalizePhone(value: unknown) {
  return typeof value === 'string' ? value.replace(/[\s()-]/g, '').trim() : ''
}

export function validatePassword(password: string) {
  const errors: string[] = []
  if (password.length < 8) errors.push('at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter')
  if (!/\d/.test(password)) errors.push('one number')
  return errors
}

export function cleanName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}
