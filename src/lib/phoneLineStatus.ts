/**
 * Optional server-only carrier status lookup.  Never import this module from a
 * client component or expose Twilio credentials through NEXT_PUBLIC_* variables.
 *
 * A carrier status lookup does NOT verify that the registering user owns a
 * number. Coverage varies across operators/countries; unknown is NOT invalid.
 */
import 'server-only'

export type PhoneLineStatus = 'active' | 'reachable' | 'unreachable' | 'inactive' | 'unknown' | 'not_checked'
export type PhoneLineResult = { status: PhoneLineStatus; checked: boolean }

// Soft in-process budget as a second safeguard; configure provider-side billing
// alerts and an edge/WAF rate limiter before enabling lookups on public signup.
let windowStartedAt = Date.now()
let checksInWindow = 0

export async function lookupPhoneLineStatus(e164: string): Promise<PhoneLineResult> {
  if (process.env.PHONE_LOOKUP_MODE !== 'twilio') {
    return { status: 'not_checked', checked: false }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return { status: 'not_checked', checked: false }
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) return { status: 'unknown', checked: false }

  const hour = 60 * 60 * 1000
  if (Date.now() - windowStartedAt >= hour) {
    windowStartedAt = Date.now()
    checksInWindow = 0
  }
  const budget = Math.min(1000, Math.max(0, Number.parseInt(process.env.PHONE_LOOKUP_HOURLY_LIMIT || '30', 10) || 0))
  if (checksInWindow >= budget) return { status: 'unknown', checked: false }
  checksInWindow += 1

  try {
    const authorization = Buffer.from(`${sid}:${token}`, 'utf8').toString('base64')
    const endpoint = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_status`
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Basic ${authorization}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return { status: 'unknown', checked: false }
    const data = (await response.json()) as {
      valid?: boolean
      line_status?: { status?: string | null; error_code?: number | null } | null
    }
    if (data.valid === false) return { status: 'inactive', checked: true }
    if (data.line_status?.error_code) return { status: 'unknown', checked: false }
    const status = (data.line_status?.status || '').toLowerCase().trim()
    if (status === 'active' || status === 'reachable' || status === 'unreachable' || status === 'inactive') {
      return { status, checked: true }
    }
    return { status: 'unknown', checked: false }
  } catch {
    // API outages, timeouts and lack of operator coverage are not proof that
    // a real person's number is invalid.  Do not log raw phone/credentials.
    return { status: 'unknown', checked: false }
  }
}

export function isConfirmedInactive(line: PhoneLineResult) {
  return line.checked && line.status === 'inactive'
}

export function phoneLineStatusExplanation(result: PhoneLineResult) {
  if (result.status === 'active' || result.status === 'reachable') {
    return 'Carrier network reports this number as active; ownership is not verified.'
  }
  if (result.status === 'unreachable') {
    return 'Carrier reports an assigned line that is currently unreachable; ownership is not verified.'
  }
  if (result.status === 'inactive') return 'Carrier reports this number as inactive or unassigned.'
  return 'Phone number passed numbering-plan validation; active status and ownership were not verified.'
}
