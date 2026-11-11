'use client'

import ParishLogo from '../components/ParishLogo'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import InternationalPhoneField from '@/components/auth/InternationalPhoneField'

export default function CompleteProfilePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    phoneNumber: '',
    phoneCountry: 'PH',
  })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          router.replace('/login')
          return
        }

        const user = data.user

        if (data.profileComplete) {
          router.replace('/dashboard')
          return
        }

        setEmail(user.email || '')
        setForm({
          firstName: user.firstName || '',
          middleName: user.middleName || '',
          surname: user.surname || '',
          phoneNumber: user.phoneNumber || '',
          phoneCountry: parsePhoneNumberFromString(user.phoneNumber || '', 'PH')?.country || 'PH',
        })
      } catch (error) {
        console.error('LOAD PROFILE ERROR:', error)
        alert('Unable to load your profile.')
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [router])

  const change = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) => {
    setForm(previous => ({
      ...previous,
      [event.target.name]: event.target.value,
    }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(
        '/api/auth/complete-profile',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        alert(
          data.message ||
            'Unable to complete your profile.'
        )
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('SAVE PROFILE ERROR:', error)
      alert(
        'Unable to complete your profile right now.'
      )
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fbff]">
        <p className="text-slate-600">
          Loading your profile...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl bg-white border border-amber-100 rounded-3xl p-8 md:p-10 shadow-xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <ParishLogo height={96} />
          </div>

          <h1 className="text-2xl font-semibold text-navy-mid">
            Complete Your Parish Profile
          </h1>

          <p className="text-slate-600 text-sm mt-2">
            Your Google email is verified. Confirm your name to continue. Your phone is optional; an address can be added later in your profile.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <Field label="First Name *">
            <input
              name="firstName"
              value={form.firstName}
              onChange={change}
              autoComplete="given-name"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Middle Name">
            <input
              name="middleName"
              value={form.middleName}
              onChange={change}
              autoComplete="additional-name"
              className={inputClass}
            />
          </Field>

          <Field label="Surname *">
            <input
              name="surname"
              value={form.surname}
              onChange={change}
              autoComplete="family-name"
              required
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <InternationalPhoneField country={form.phoneCountry} phoneNumber={form.phoneNumber}
              onCountryChange={v=>setForm(p=>({...p,phoneCountry:v}))}
              onPhoneChange={v=>setForm(p=>({...p,phoneNumber:v}))}
              inputClass={inputClass} />
          </div>
          <div className="md:col-span-2">
            <Field label="Verified Email">
              <input
                value={email}
                readOnly
                className={`${inputClass} bg-slate-50 cursor-not-allowed`}
              />
            </Field>
          </div>


          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 bg-navy text-white rounded-xl py-3.5 font-semibold hover:bg-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Saving Profile...'
              : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-mid mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}
