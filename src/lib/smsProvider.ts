/** Server-only OTP transport. Sending is opt-in; TextBee remains the legacy default. */
import 'server-only'

type Provider = 'textbee' | 'twilio' | 'disabled'

function provider(): Provider {
  const selected = process.env.PHONE_OTP_PROVIDER?.trim().toLowerCase()
  if (selected === 'twilio') return 'twilio'
  if (selected === 'textbee') return 'textbee'
  if (selected) return 'disabled'
  return process.env.TEXTBEE_OTP_ENABLED === 'true' ? 'textbee' : 'disabled'
}

export function otpSmsConfigured(): boolean {
  if (!process.env.PHONE_OTP_PEPPER || process.env.PHONE_OTP_PEPPER.length < 32) return false
  if (provider() === 'textbee') {
    return process.env.TEXTBEE_OTP_ENABLED === 'true' && Boolean(process.env.TEXTBEE_API_KEY?.trim())
  }
  if (provider() === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID || ''
    const auth = process.env.TWILIO_AUTH_TOKEN || ''
    const service = process.env.TWILIO_MESSAGING_SERVICE_SID || ''
    const from = process.env.TWILIO_SMS_FROM || ''
    return process.env.TWILIO_SMS_ENABLED === 'YES' &&
      /^AC[0-9a-fA-F]{32}$/.test(sid) && Boolean(auth) &&
      (/^MG[0-9a-fA-F]{32}$/.test(service) || /^\+[1-9]\d{6,14}$/.test(from))
  }
  return false
}

export async function sendOtpSms(to: string, body: string): Promise<void> {
  if (!otpSmsConfigured() || !/^\+639\d{9}$/.test(to)) {
    throw new Error('SMS is not configured for this recipient.')
  }
  if (provider() === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const params = new URLSearchParams({ To: to, Body: body })
    const service = process.env.TWILIO_MESSAGING_SERVICE_SID
    if (service) params.set('MessagingServiceSid', service)
    else params.set('From', process.env.TWILIO_SMS_FROM!)
    const authorization = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`, 'utf8').toString('base64')
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(), cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || typeof result.sid !== 'string' || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(result.sid)) {
      throw new Error('SMS provider rejected the request.')
    }
    return
  }
  const payload: { recipients: string[]; message: string; deviceId?: string } = {
    recipients: [to], message: body,
  }
  if (process.env.TEXTBEE_DEVICE_ID?.trim()) payload.deviceId = process.env.TEXTBEE_DEVICE_ID.trim()
  const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.TEXTBEE_API_KEY! },
    body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(15000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result?.data?.success === false) throw new Error('SMS provider rejected the request.')
}
