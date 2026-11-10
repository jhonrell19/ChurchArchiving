'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import GoogleAuthButton from '@/components/auth/GoogleAuthButton'

export default function LoginPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const [loading, setLoading] = useState(false)
  const [verificationEmail, setVerificationEmail] =
    useState('')
  const [verificationMessage, setVerificationMessage] =
    useState('')

  const change = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(previous => ({
      ...previous,
      [event.target.name]: event.target.value,
    }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    setLoading(true)
    setVerificationMessage('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.verificationRequired) {
          setVerificationEmail(
            form.email.trim().toLowerCase()
          )
          setVerificationMessage(
            data.message ||
              'Please verify your email address before signing in.'
          )
        } else {
          alert(data.message || 'Login failed.')
        }
        return
      }

      if (data.mfaRequired) {
        router.replace('/staff-mfa')
        router.refresh()
        return
      }

      if (
        data.user?.role === 'USER' &&
        data.needsProfileCompletion
      ) {
        router.replace('/complete-profile')
        router.refresh()
        return
      }

      switch (data.user?.role) {
        case 'ADMIN':
          router.replace('/admin')
          break
        case 'BURIAL_ADMIN':
          router.replace('/burial-admin')
          break
        case 'USER':
          router.replace('/dashboard')
          break
        default:
          alert('Unknown account role.')
          return
      }

      router.refresh()
    } catch (error) {
      console.error('LOGIN ERROR:', error)
      alert(
        'Unable to sign in right now. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!verificationEmail) return

    try {
      const response = await fetch(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: verificationEmail,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      setVerificationMessage(
        data.message || 'Verification request processed.'
      )
    } catch {
      setVerificationMessage(
        'Unable to resend verification right now.'
      )
    }
  }

  const inputClass =
    'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-body text-[15px] text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-gold opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white border border-amber-100 rounded-3xl px-8 md:px-10 py-10 shadow-xl shadow-slate-200/60">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-gold text-3xl">✝</span>
          </div>

          <h1 className="font-display text-navy-mid text-lg tracking-wide mb-2 font-semibold">
            Iglesia Filipina Independiente
          </h1>

          <p className="font-body italic text-slate-600 text-[13px]">
            Parish Portal — Maragondon, Cavite
          </p>
        </div>

        <h2 className="text-center text-navy-mid text-xl font-semibold mb-2">
          Sign In
        </h2>

        <p className="text-center text-slate-600 text-sm mb-8">
          Sign in to an existing account. New Google users
          should use Register first.
        </p>

        <form
          onSubmit={submit}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="block text-navy-mid mb-2 text-sm font-semibold">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="your@email.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2 gap-3">
              <label className="text-navy-mid text-sm font-semibold">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-gold hover:text-amber-600 text-xs font-semibold"
              >
                Forgot password?
              </Link>
            </div>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-navy text-white py-3.5 rounded-xl font-display text-[12px] uppercase tracking-wider hover:bg-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-600 font-semibold whitespace-nowrap">
            Or sign in with
          </span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        <div>
          <GoogleAuthButton intent="login" />
        </div>

        {verificationEmail && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-amber-800 text-sm">
              {verificationMessage}
            </p>

            <button
              type="button"
              onClick={() => void resendVerification()}
              className="mt-2 text-gold font-semibold text-xs underline"
            >
              Resend verification link
            </button>

          </div>
        )}

        <p className="text-center text-slate-600 mt-7 text-sm">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-gold font-semibold hover:text-amber-600"
          >
            Register
          </Link>
        </p>

        <p className="text-center text-slate-500 mt-3 text-[11px] leading-relaxed">
          Google authentication is for parishioner accounts only.
          Staff accounts use email and password.
        </p>
      </div>
    </div>
  )
}
