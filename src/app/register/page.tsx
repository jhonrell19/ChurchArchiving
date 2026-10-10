'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

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

  const change = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }))
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

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.message || 'Registration failed.')
        return
      }

      alert('Account created successfully. You may now log in.')

      router.push('/login')
    } catch (error) {
      console.error(error)

      alert('Something went wrong while creating your account.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `
    w-full
    bg-white/5
    border
    border-gold/20
    rounded-lg
    px-4
    py-3
    text-white
    outline-none
    placeholder:text-white/30
    focus:border-gold/60
  `

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-20">

      <div className="w-full max-w-2xl bg-white/4 border border-gold/20 rounded-2xl px-8 md:px-10 py-10">

        <div className="text-center mb-8">

          <span className="block text-gold text-4xl mb-3">
            ✝
          </span>

          <h1 className="font-display text-gold text-2xl">
            Create Parish Account
          </h1>

          <p className="text-txt-md mt-2 text-sm">
            Register to access parish services and document requests.
          </p>

        </div>

        <form
          onSubmit={submit}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >

          {/* First Name */}

          <div>
            <label className="text-gold/70 text-sm">
              First Name *
            </label>

            <input
              name="firstName"
              value={form.firstName}
              onChange={change}
              placeholder="First name"
              required
              className={inputClass}
            />
          </div>

          {/* Middle Name */}

          <div>
            <label className="text-gold/70 text-sm">
              Middle Name
            </label>

            <input
              name="middleName"
              value={form.middleName}
              onChange={change}
              placeholder="Middle name"
              className={inputClass}
            />
          </div>

          {/* Surname */}

          <div>
            <label className="text-gold/70 text-sm">
              Surname *
            </label>

            <input
              name="surname"
              value={form.surname}
              onChange={change}
              placeholder="Surname"
              required
              className={inputClass}
            />
          </div>

          {/* Phone */}

          <div>
            <label className="text-gold/70 text-sm">
              Phone Number *
            </label>

            <input
              type="tel"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={change}
              placeholder="09XXXXXXXXX"
              required
              className={inputClass}
            />
          </div>

          {/* Address */}

          <div className="md:col-span-2">

            <label className="text-gold/70 text-sm">
              Address *
            </label>

            <textarea
              name="address"
              value={form.address}
              onChange={change}
              placeholder="House number, street, barangay, municipality/city, province"
              required
              rows={3}
              className={inputClass}
            />

          </div>

          {/* Email */}

          <div className="md:col-span-2">

            <label className="text-gold/70 text-sm">
              Email Address *
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="your@email.com"
              required
              className={inputClass}
            />

          </div>

          {/* Password */}

          <div>

            <label className="text-gold/70 text-sm">
              Password *
            </label>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className={inputClass}
            />

          </div>

          {/* Confirm Password */}

          <div>

            <label className="text-gold/70 text-sm">
              Confirm Password *
            </label>

            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={change}
              placeholder="Repeat password"
              minLength={8}
              required
              className={inputClass}
            />

          </div>

          <button
            type="submit"
            disabled={loading}
            className="
              md:col-span-2
              bg-gold
              text-navy
              py-3.5
              rounded-lg
              font-display
              uppercase
              tracking-wider
              disabled:opacity-50
            "
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

        </form>

        {/* Social accounts will be connected here next */}

        <div className="flex items-center gap-3 my-7">

          <div className="flex-1 h-px bg-gold/20" />

          <span className="text-gold/40 text-xs uppercase">
            Or register with
          </span>

          <div className="flex-1 h-px bg-gold/20" />

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <button
            type="button"
            disabled
            className="
              border
              border-white/20
              rounded-lg
              py-3
              text-white/50
              cursor-not-allowed
            "
          >
            Continue with Google
          </button>

          <button
            type="button"
            disabled
            className="
              border
              border-white/20
              rounded-lg
              py-3
              text-white/50
              cursor-not-allowed
            "
          >
            Continue with Facebook
          </button>

        </div>

        <p className="text-center text-txt-md mt-7">
          Already have an account?{' '}

          <Link
            href="/login"
            className="text-gold underline"
          >
            Login
          </Link>

        </p>

      </div>

    </div>
  )
}