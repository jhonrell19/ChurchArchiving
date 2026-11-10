'use client'

import { useCallback, useEffect, useState } from 'react'

export default function PhoneOtpPanel({ phoneNumber }: { phoneNumber: string | null }) {
  const [configured, setConfigured] = useState(false)
  const [verified, setVerified] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/phone-otp', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setVerified(Boolean(data.verified)); setConfigured(Boolean(data.configured)) }
    } catch { setMessage('Phone verification service is unavailable.') }
  }, [])
  useEffect(() => { void refresh(); setSent(false); setCode(''); setMessage('') }, [refresh, phoneNumber])

  async function action(name: 'send' | 'verify') {
    setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/auth/phone-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, code }) })
      const data = await res.json().catch(() => ({}))
      setMessage(data.message || 'Unable to complete request.')
      if (res.ok && name === 'send') setSent(true)
      if (res.ok && data.verified) { setVerified(true); setCode('') }
    } catch { setMessage('SMS verification is temporarily unavailable.') }
    finally { setBusy(false) }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 mb-4">
    <h3 className="text-navy-mid font-semibold">Mobile number verification</h3>
    {!phoneNumber ? <p className="text-sm text-slate-700">Add a Philippine mobile number above if you want to verify it.</p> : verified ?
      <p className="text-sm text-emerald-700">Your saved number is verified by SMS.</p> : <>
      <p className="text-sm text-slate-700">Your saved phone number is not verified. We can send a one-time code to the number ending in {phoneNumber.slice(-4)}.</p>
      {configured ? <>
        <button type="button" disabled={busy} onClick={() => void action('send')} className="rounded-lg bg-blue-900 text-white px-4 py-2 text-sm disabled:opacity-50">Send SMS code</button>
        {sent && <div className="flex flex-wrap items-center gap-2">
          <input value={code} onChange={e => setCode(e.target.value.replace(/[^\d]/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit SMS code" className="border rounded-lg px-3 py-2 text-slate-900" />
          <button type="button" disabled={busy || code.length !== 6} onClick={() => void action('verify')} className="bg-blue-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Verify number</button>
        </div>}
      </> : <p className="text-xs text-amber-800">TextBee OTP is not enabled on the server yet. Your number remains unverified.</p>}
    </>}
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </section>
}
