'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [developmentVerificationUrl, setDevelopmentVerificationUrl] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    phoneNumber: '',
    address: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(previous => ({ ...previous, [e.target.name]: e.target.value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.message || 'Registration failed.')
        return
      }

      setVerificationMessage(data.message || 'Account created. Verify your email before signing in.')
      setDevelopmentVerificationUrl(data.developmentVerificationUrl || '')
      if (!data.verificationRequired) router.push('/login')
    } catch (error) {
      console.warn(error)
      alert('Something went wrong while creating your account.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-2xl bg-white border border-amber-100 rounded-3xl px-8 md:px-10 py-10 shadow-xl shadow-slate-200/60">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-gold text-3xl">✝</span>
          </div>
          <h1 className="font-display text-navy-mid text-2xl font-semibold">Create Parish Account</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Register your information once so document requests can use your verified profile details.
          </p>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="First Name *">
            <input name="firstName" value={form.firstName} onChange={change} placeholder="First name" autoComplete="given-name" required className={inputClass} />
          </Field>
          <Field label="Middle Name">
            <input name="middleName" value={form.middleName} onChange={change} placeholder="Middle name" autoComplete="additional-name" className={inputClass} />
          </Field>
          <Field label="Surname *">
            <input name="surname" value={form.surname} onChange={change} placeholder="Surname" autoComplete="family-name" required className={inputClass} />
          </Field>
          <Field label="Phone Number *">
            <input type="tel" name="phoneNumber" value={form.phoneNumber} onChange={change} placeholder="09XXXXXXXXX" autoComplete="tel" required className={inputClass} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Address *">
              <textarea name="address" value={form.address} onChange={change} placeholder="House number, street, barangay, municipality/city, province" autoComplete="street-address" required rows={3} className={`${inputClass} resize-none`} />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Email Address *">
              <input type="email" name="email" value={form.email} onChange={change} placeholder="your@email.com" autoComplete="email" required className={inputClass} />
            </Field>
          </div>

          <Field label="Password *">
            <input type="password" name="password" value={form.password} onChange={change} placeholder="8+ chars, uppercase, lowercase, number" autoComplete="new-password" minLength={8} required className={inputClass} />
          </Field>
          <Field label="Confirm Password *">
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} placeholder="Repeat password" autoComplete="new-password" minLength={8} required className={inputClass} />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-navy text-white py-3.5 rounded-xl font-display text-[12px] uppercase tracking-wider hover:bg-navy-mid transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-7 rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
          <p className="font-body text-blue-700 text-[12px]">
            Google and Facebook sign-in will be connected after the current account verification and request workflow is finalized.
          </p>
        </div>

        {verificationMessage && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-emerald-700 text-sm">{verificationMessage}</p>
            {developmentVerificationUrl && (
              <a href={developmentVerificationUrl} className="block mt-2 text-blue-700 text-xs underline break-all">
                Development verification link
              </a>
            )}
          </div>
        )}

        <p className="text-center text-slate-500 mt-7 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-gold font-semibold hover:text-amber-600">Login</Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-navy-mid text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  )
}
