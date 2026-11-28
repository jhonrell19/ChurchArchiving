import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sendTransactionalEmail } from '@/lib/email'

export async function POST() {
  const user = await getCurrentUser()
  if (user?.role !== 'USER' || !user.emailVerified) {
    return NextResponse.json({error:'Please sign in with a verified parishioner account.'}, {status:403})
  }
  try {
    const upstream = await fetch(new URL('/api/internal/request-code', process.env.FLASK_API_URL), {
      method:'POST', cache:'no-store', signal:AbortSignal.timeout(20000), headers:{
        'X-Internal-Key':process.env.FLASK_INTERNAL_KEY || '', 'X-User-Role':'REQUEST_CODE_MAILER',
        'X-User-Id':String(user.id), 'X-User-Email':user.email,
      },
    })
    if (upstream.status === 429) return NextResponse.json({error:'Wait one minute before requesting another code.'}, {status:429})
    if (!upstream.ok) throw new Error('code service HTTP ' + upstream.status)
    const { code } = await upstream.json()
    if (!/^\d{6}$/.test(code)) throw new Error('invalid delivery response')
    const mail = await sendTransactionalEmail({to:user.email, subject:'Confirm your certificate request',
      html:'<p>Your Smart Parish certificate request code is <strong>' + code + '</strong>. It expires in ten minutes.</p>'})
    if (!mail.sent) throw new Error('mail transport unavailable')
    return NextResponse.json({message:'Check your account inbox for the six-digit code.'})
  } catch {
    console.warn('Certificate request verification delivery unavailable')
    return NextResponse.json({error:'Could not send the verification email. Please retry in one minute.'},{status:503})
  }
}
