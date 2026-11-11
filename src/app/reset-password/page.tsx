'use client'

import ParishLogo from '../components/ParishLogo'


import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
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
      console.warn('Reset password error:', error)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-10 shadow-xl shadow-slate-200/60">
        <div className="text-center mb-8">
          <div className="mb-3 flex justify-center"><ParishLogo height={88} /></div>
          <h1 className="font-display text-navy-mid text-lg font-semibold">
            Reset Password
          </h1>
          <p className="font-body text-slate-500 text-[13px] mt-2">
            Enter your new account password.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block font-display text-[10px] tracking-wider uppercase text-navy-mid mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-body text-[15px] text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10"
            />
          </div>

          <div>
            <label className="block font-display text-[10px] tracking-wider uppercase text-navy-mid mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-body text-[15px] text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10"
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-navy text-white font-display text-[11px] tracking-wider uppercase py-3 rounded-xl hover:bg-navy-mid disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-gold font-semibold font-body text-[13px] hover:text-amber-600">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
          <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-10 shadow-xl shadow-slate-200/60 text-center">
            <p className="font-body text-slate-500 text-[13px]">Loading password reset...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
