import { createRequire } from 'node:module'

type SendEmailInput = {
  to: string
  subject: string
  html: string
}

/** Account verification must be real email delivery, even during ngrok testing. */
export function isTransactionalEmailConfigured() {
  if (process.env.EMAIL_TRANSPORT === 'gmail-smtp') {
    return Boolean(/^[^@\s]+@gmail\.com$/i.test(process.env.GMAIL_SMTP_USER || '') &&
      process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, '').length === 16)
  }
  const apiKey = process.env.RESEND_API_KEY?.trim() || ''
  const from = process.env.EMAIL_FROM?.trim() || ''
  return Boolean(apiKey && !apiKey.startsWith('REPLACE_') &&
    !apiKey.startsWith('re_XXXXXXXX') && from.includes('@') &&
    !from.includes('example.com') && !from.includes('localhost'))
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  // Optional no-domain test alternative. Use an app password, NEVER the Google login password.
  // For production, prefer Resend with a parish-controlled and verified sender domain.
  if (process.env.EMAIL_TRANSPORT === 'gmail-smtp') {
    if (!isTransactionalEmailConfigured()) return { sent: false, reason: 'Gmail SMTP is not configured.' }
    try {
      const requireModule = createRequire(import.meta.url)
      // npm install nodemailer (only needed when EMAIL_TRANSPORT=gmail-smtp)
      const nodemailer = requireModule('nodemailer')
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: process.env.GMAIL_SMTP_USER, pass: process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, '') },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 12000,
      })
      await transport.sendMail({
        from: `Smart Parish <${process.env.GMAIL_SMTP_USER}>`,
        to: input.to, subject: input.subject, html: input.html,
      })
      return { sent: true }
    } catch {
      console.error('EMAIL SEND ERROR: Gmail SMTP provider failed.')
      return { sent: false, reason: 'Email provider could not deliver the message.' }
    }
  }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!isTransactionalEmailConfigured() || !apiKey || !from) {
    return { sent: false, reason: 'Email provider not configured.' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error('EMAIL SEND ERROR (provider HTTP status):', response.status)
      return { sent: false, reason: 'Email provider rejected the request.' }
    }
    return { sent: true }
  } catch {
    return { sent: false, reason: 'Email service is temporarily unavailable.' }
  }
}

export function appBaseUrl(requestUrl?: string) {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') {
    if (!configured?.startsWith('https://')) throw new Error('APP_BASE_URL must be an HTTPS URL in production')
    return configured
  }
  if (configured) return configured

  if (requestUrl) {
    const url = new URL(requestUrl)
    return `${url.protocol}//${url.host}`
  }

  return 'http://localhost:3000'
}
