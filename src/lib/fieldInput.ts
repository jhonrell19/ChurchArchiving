/** Field-specific input rules shared by parish request, account and archive forms.
 * Do not apply the name filter to addresses, email, passwords or record references.
 * Human names may include Unicode letters/diacritics, spaces, apostrophes,
 * periods and hyphens, but not digits or unrelated symbols.
 */
export const sanitizePersonName = (value: string): string =>
  value.replace(/[^\p{L}\p{M} .'’\-]/gu, '')

export const isValidPersonName = (value: string, maxLength = 150): boolean => {
  const name = value.trim()
  return name.length >= 2 && name.length <= maxLength &&
    /\p{L}/u.test(name) && sanitizePersonName(name) === name
}

export const digitsOnly = (value: string, maxLength?: number): string => {
  const digits = value.replace(/\D/g, '')
  return maxLength == null ? digits : digits.slice(0, maxLength)
}

export const phoneCharactersOnly = (value: string): string => {
  const cleaned = value.replace(/[^\d+]/g, '')
  return (cleaned.startsWith('+') ? '+' : '') + cleaned.replace(/\+/g, '')
}

export const philippineToday = (): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const isValidPastCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value <= philippineToday()
}
