'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      alert('Reset token is missing.')
      return
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.message || 'Password reset failed')
        return
      }

      alert('Password reset successfully. You can now log in.')
      router.push('/login')
    } catch (error) {
      console.error('Reset password error:', error)
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
            Reset Password
          </h1>
          <p className="font-body text-txt-md text-[13px] mt-2">
            Enter your new account password.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block font-display text-[10px] tracking-wider uppercase text-gold/60 mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 font-body text-[15px] text-txt-lt outline-none placeholder:text-txt-md/40 focus:border-gold/60"
            />
          </div>

          <div>
            <label className="block font-display text-[10px] tracking-wider uppercase text-gold/60 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 font-body text-[15px] text-txt-lt outline-none placeholder:text-txt-md/40 focus:border-gold/60"
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-gold text-navy font-display text-[11px] tracking-wider uppercase py-3 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-gold/70 underline font-body text-[13px]">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}