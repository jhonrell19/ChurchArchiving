'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLink, setResetLink] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResetLink('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.message || 'Failed to generate reset link')
        return
      }

      setResetLink(data.resetLink)
    } catch (error) {
      console.error('Forgot password error:', error)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white/5 border border-gold/20 rounded-2xl p-10">
        <div className="text-center mb-8">
          <span className="block text-gold text-4xl mb-3">✝</span>
          <h1 className="font-display text-gold text-lg">
            Forgot Password
          </h1>
          <p className="font-body text-txt-md text-[13px] mt-2">
            Enter your account email to generate a password reset link.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block font-display text-[10px] tracking-wider uppercase text-gold/60 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 font-body text-[15px] text-txt-lt outline-none placeholder:text-txt-md/40 focus:border-gold/60"
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-gold text-navy font-display text-[11px] tracking-wider uppercase py-3 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Generate Reset Link'}
          </button>
        </form>

        {resetLink && (
          <div className="mt-6 bg-gold/10 border border-gold/20 rounded-xl p-4">
            <p className="font-body text-[12px] text-txt-md mb-3">
              Demo reset link generated. In a real system, this would be sent through email.
            </p>

            <Link
              href={resetLink}
              className="inline-block bg-navy border border-gold/30 text-gold font-display text-[11px] tracking-wider px-4 py-2 rounded-lg"
            >
              Open Reset Password Page
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-gold/70 underline font-body text-[13px]">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}