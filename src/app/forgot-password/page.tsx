'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [devUrl, setDevUrl] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setDevUrl('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      setMessage(data.message || 'Request processed.')
      if (data.developmentResetUrl) setDevUrl(data.developmentResetUrl)
    } catch {
      setMessage('Unable to start password recovery right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-10 shadow-xl shadow-slate-200/60">
        <div className="text-center mb-7">
          <div className="text-gold text-4xl mb-3">✝</div>
          <h1 className="font-display text-navy-mid text-lg font-semibold">Password Recovery</h1>
          <p className="font-body text-slate-500 text-[13px] mt-2">Enter the email address registered to your parish account.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-navy-mid outline-none focus:border-gold" />
          <button disabled={loading} className="w-full bg-navy text-white py-3 rounded-xl font-display text-[11px] tracking-wider disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        {message && <p className="mt-5 text-sm text-slate-600 text-center">{message}</p>}
        {devUrl && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-700 mb-2">Development only:</p>
            <a href={devUrl} className="text-xs text-blue-700 underline break-all">Open reset link</a>
          </div>
        )}
        <div className="mt-6 text-center"><Link href="/login" className="text-gold font-semibold text-sm">Back to Login</Link></div>
      </div>
    </div>
  )
}
