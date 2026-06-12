'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Role = 'guest' | 'admin' | 'burial_admin'

export default function LoginPage() {
  const [role, setRole]       = useState<Role>('guest')
  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const change = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        role,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.message || 'Login failed')
      setLoading(false)
      return
    }

    setLoading(false)

    if (data.user.role === 'admin') {
  router.push('/admin')
} else if (data.user.role === 'burial_admin') {
  router.push('/burial-admin')
} else {
  router.push('/dashboard')
}

  } catch (error) {
    alert('Something went wrong')
    setLoading(false)
  }
}

  const inputCls = `w-full bg-white/5 border border-gold/20 rounded-lg px-4 py-3
    font-body text-[15px] text-txt-lt outline-none placeholder:text-txt-md/40
    focus:border-gold/60 transition-colors duration-200`

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-24 relative overflow-hidden">

      <div className="absolute inset-0 bg-grid-gold pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/4 border border-gold/20
        rounded-2xl px-10 py-12 backdrop-blur-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="block text-gold text-4xl mb-4 animate-pulse-cross">✝</span>
          <h1 className="font-display text-gold text-lg tracking-wide mb-2">
            Iglesia Filipina Independiente
          </h1>
          <p className="font-body italic text-txt-md text-[13px]">
            Parish Portal — Maragondon, Cavite
          </p>
          <div className="gold-divider mt-5">
            <span style={{ width: '40px' }} />
            <span className="diamond" />
            <span style={{ width: '40px' }} />
          </div>
        </div>

        {/* Role Tabs */}
        <div className="flex rounded-lg border border-gold/20 overflow-hidden mb-8">
          {(['guest', 'admin', 'burial_admin'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2.5 font-display text-[10px] tracking-[1.8px] uppercase
                transition-all duration-300
                ${role === r
                  ? 'bg-gold text-navy'
                  : 'bg-transparent text-gold/50 hover:text-gold/80'
                }`}
            >
              {r === 'guest'
  ? '✦ Guest'
  : r === 'admin'
  ? '⬡ Main Admin'
  : '✝ Burial Admin'}
            </button>
          ))}
        </div>

        {/* Role description */}
        <p className="font-body text-[12px] text-txt-md/60 text-center mb-6 leading-relaxed min-h-[36px]">
          {role === 'guest'
  ? 'Access parish announcements, schedules, and public resources.'
  : role === 'admin'
  ? 'Manage baptismal, confirmation, marriage records, masses, and parish announcements.'
  : 'Manage burial records, deceased documents, land agreements, and burial office requests.'}
        </p>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <label className="block font-display text-[10px] tracking-[1.5px] uppercase text-gold/50 mb-2">
              Email Address
            </label>
            <input
              type="email" name="email" value={form.email} onChange={change}
              placeholder="your@email.com" required className={inputCls}
            />
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label className="font-display text-[10px] tracking-[1.5px] uppercase text-gold/50">
                Password
              </label>
              <Link
  href="/forgot-password"
  className="font-display text-[9px] tracking-wider uppercase text-gold/40 hover:text-gold transition-colors"
>
  Forgot password?
</Link>
            </div>
            <input
              type="password" name="password" value={form.password} onChange={change}
              placeholder="••••••••" required className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 w-full font-display text-[11px] tracking-[2px] uppercase
              py-3.5 rounded-lg transition-all duration-300
              ${loading
                ? 'bg-gold/50 text-navy/70 cursor-not-allowed'
                : 'bg-gold text-navy hover:bg-gold-lt'
              }`}
          >
            {loading
  ? 'Signing in…'
  : role === 'guest'
  ? 'Sign In as Guest'
  : role === 'admin'
  ? 'Sign In as Main Admin'
  : 'Sign In as Burial Admin'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-7">
          <span className="flex-1 h-px bg-gold/15" />
          <span className="font-display text-[9px] tracking-widest uppercase text-gold/30">
            {role === 'guest' ? 'Parish Access' : 'Authorized Staff Only'}
          </span>
          <span className="flex-1 h-px bg-gold/15" />
        </div>

        <p className="font-body text-[13px] text-txt-md text-center leading-relaxed">
          {role === 'guest'
            ? <>New here?{' '}
                <Link href="/register" className="text-gold/70 underline hover:text-gold transition-colors">
                  Request a guest account
                </Link>{' '}or{' '}
                <Link href="/contact" className="text-gold/70 underline hover:text-gold transition-colors">
                  contact the parish office
                </Link>.
              </>
            : <>Admin access is for authorized parish staff only. For issues, please{' '}
                <Link href="/contact" className="text-gold/70 underline hover:text-gold transition-colors">
                  contact the parish office
                </Link>.
              </>
          }
        </p>
      </div>
    </div>
  )
}