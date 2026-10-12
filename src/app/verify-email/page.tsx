'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working')
  const [message, setMessage] = useState('Verifying your email address...')

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Verification token is missing.')
        return
      }

      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json().catch(() => ({}))
        setMessage(data.message || (res.ok ? 'Email verified.' : 'Verification failed.'))
        setStatus(res.ok ? 'success' : 'error')
      } catch {
        setStatus('error')
        setMessage('Unable to verify email right now.')
      }
    }

    void run()
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-10 text-center shadow-xl shadow-slate-200/60">
        <div className="text-gold text-4xl mb-4">✝</div>
        <h1 className="font-display text-navy-mid text-xl font-semibold mb-3">
          Email Verification
        </h1>

        <p
          className={`font-body text-[13px] mb-6 ${
            status === 'error'
              ? 'text-red-600'
              : status === 'success'
                ? 'text-emerald-700'
                : 'text-slate-500'
          }`}
        >
          {message}
        </p>

        {status === 'success' && (
          <Link
            href="/login"
            className="inline-block bg-navy text-white px-5 py-2.5 rounded-xl font-display text-[11px] tracking-wider"
          >
            Continue to Login
          </Link>
        )}

        {status === 'error' && (
          <Link href="/login" className="text-gold font-semibold text-sm">
            Back to Login
          </Link>
        )}
      </div>
    </div>
  )
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-10 text-center shadow-xl shadow-slate-200/60">
        <div className="text-gold text-4xl mb-4">✝</div>
        <h1 className="font-display text-navy-mid text-xl font-semibold mb-3">
          Email Verification
        </h1>
        <p className="font-body text-[13px] text-slate-500">
          Preparing verification...
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
