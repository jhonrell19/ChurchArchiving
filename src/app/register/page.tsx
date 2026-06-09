'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: 'guest',
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      alert(data.message || 'Register failed')
      return
    }

    alert('Account created successfully')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md bg-white/4 border border-gold/20 rounded-2xl px-10 py-12">
        <h1 className="font-display text-gold text-xl text-center mb-8">
          Create Guest Account
        </h1>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <input
            name="fullName"
            placeholder="Full Name"
            value={form.fullName}
            onChange={change}
            required
            className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-white"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={form.email}
            onChange={change}
            required
            className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-white"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={change}
            required
            className="w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3 text-white"
          />

          <button
            disabled={loading}
            className="bg-gold text-navy py-3 rounded-lg font-display uppercase"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-txt-md mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-gold underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}