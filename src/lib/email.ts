type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return { sent: false, reason: 'Email provider not configured.' }
  }

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
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('EMAIL SEND ERROR:', response.status, body)
    return { sent: false, reason: 'Email provider rejected the request.' }
  }

  return { sent: true }
}

export function appBaseUrl(requestUrl?: string) {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured

  if (requestUrl) {
    const url = new URL(requestUrl)
    return `${url.protocol}//${url.host}`
  }

  return 'http://localhost:3000'
}
