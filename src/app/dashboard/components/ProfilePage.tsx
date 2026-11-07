'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import InternationalPhoneField from '@/components/auth/InternationalPhoneField'
import StructuredAddressField, { emptyAddress, type AddressInfo } from '@/components/auth/StructuredAddressField'

type UserProfile = {
  id: number
  firstName: string | null
  middleName: string | null
  surname: string | null
  phoneNumber: string | null
  address: string | null
  fullName: string
  email: string
  role: string
  createdAt: string
}

const getInitials = (name: string) => {
  if (!name) return 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

const formatRole = (role: string) => {
  switch (role) {
    case 'ADMIN': return 'Administrator'
    case 'BURIAL_ADMIN': return 'Burial Administrator'
    case 'USER': return 'Parishioner'
    default: return 'Unknown role'
  }
}

const formatDate = (date: string) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCountry, setPhoneCountry] = useState('PH')
  const [phoneEdited, setPhoneEdited] = useState(false)
  const [editAddress, setEditAddress] = useState(false)
  const [clearAddress, setClearAddress] = useState(false)
  const [addressInfo, setAddressInfo] = useState<AddressInfo>(emptyAddress)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
        })

        if (res.status === 401) {
          router.replace('/login')
          router.refresh()
          return
        }

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load profile')
        }

        setUser(data.user)
        setPhone(data.user.phoneNumber || '')
        if (data.user.phoneNumber) {
          const parsed = parsePhoneNumberFromString(data.user.phoneNumber, 'PH')
          setPhoneCountry(parsed?.country || 'PH')
        }
      } catch (err) {
        console.warn('Profile load error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load profile.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])


  const saveContact = async () => {
    if (!user) return
    const payload: Record<string, unknown> = {}
    if (phoneEdited) {
      payload.phoneNumber = phone
      payload.phoneCountry = phoneCountry
    }
    if (clearAddress) payload.clearAddress = true
    else if (editAddress) payload.addressInfo = addressInfo
    if (!Object.keys(payload).length) {
      setSaveMessage('Choose a field to update first.')
      return
    }

    setSaving(true)
    setSaveMessage('')
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.message || 'Unable to save contact details.')
      setUser(previous => previous ? {
        ...previous,
        phoneNumber: result.phoneNumber ?? null,
        address: result.address ?? null,
      } : previous)
      setPhone(result.phoneNumber || '')
      setEditing(false)
      setPhoneEdited(false)
      setEditAddress(false)
      setClearAddress(false)
      setAddressInfo({ ...emptyAddress })
      setSaveMessage(['Contact details saved.', result.phoneStatusNote].filter(Boolean).join(' '))
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">My Profile</h2>
        <p className="font-body text-[#6b8caa] text-[14px] mb-6">Loading your account information...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">My Profile</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-body text-red-600 text-[13px]">{error || 'Unable to load profile.'}</p>
        </div>
      </div>
    )
  }

  const fields = [
    { label: 'Email', value: user.email, icon: 'ti-mail' },
    { label: 'Phone', value: user.phoneNumber || 'N/A', icon: 'ti-phone' },
    { label: 'Address', value: user.address || 'N/A', icon: 'ti-map-pin' },
    { label: 'User ID', value: `#${user.id}`, icon: 'ti-id' },
    { label: 'Role', value: formatRole(user.role), icon: 'ti-shield' },
    { label: 'Joined', value: formatDate(user.createdAt), icon: 'ti-calendar' },
  ]

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">My Profile</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">Your account information and preferences.</p>

      <div className="bg-white border border-gold/20 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-navy border-2 border-gold/30 flex items-center justify-center">
            <span className="font-display text-gold text-xl font-semibold">{getInitials(user.fullName)}</span>
          </div>
          <div>
            <p className="font-display text-navy-mid text-[15px] font-semibold">{user.fullName}</p>
            <p className="font-body text-[#6b8caa] text-[13px]">
              {formatRole(user.role)} · Member since {new Date(user.createdAt).getFullYear()}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-gold/10 pt-4">
          {fields.map(({ label, value, icon }) => (
            <div key={label} className="flex items-start gap-3">
              <i className={`ti ${icon} text-gold text-[16px] w-5 mt-0.5`} aria-hidden="true" />
              <span className="font-body text-[13px] text-[#6b8caa] w-20 flex-shrink-0">{label}</span>
              <span className="font-body text-[13px] text-navy-mid break-words">{value}</span>
            </div>
          ))}
        </div>
      </div>


      <div className="bg-white border border-gold/20 rounded-xl p-5 mb-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-navy-mid">Optional contact details</h3>
            <p className="text-xs text-slate-600 mt-1">Update your phone or save a mailing address for future requests.</p>
          </div>
          <button type="button" onClick={() => { setEditing(v => !v); setSaveMessage('') }}
            className="rounded-lg border border-gold/30 px-4 py-2 text-sm text-navy-mid hover:bg-amber-50">
            {editing ? 'Close' : 'Edit'}
          </button>
        </div>

        {saveMessage && <p role="status" className="text-sm text-navy-mid">{saveMessage}</p>}
        {editing && <div className="space-y-4">
          <InternationalPhoneField country={phoneCountry} phoneNumber={phone}
            onCountryChange={v => { setPhoneCountry(v); setPhoneEdited(true) }}
            onPhoneChange={v => { setPhone(v); setPhoneEdited(true) }}
            inputClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-navy-mid" />
          <label className="flex gap-2 items-center text-sm text-navy-mid">
            <input type="checkbox" checked={editAddress} onChange={e => {
              setEditAddress(e.target.checked); setClearAddress(false)
            }} />
            {user.address ? 'Replace saved address' : 'Add an address (optional)'}
          </label>
          {editAddress && <StructuredAddressField value={addressInfo} onChange={setAddressInfo} />}
          {user.address && <label className="flex gap-2 items-center text-sm text-navy-mid">
            <input type="checkbox" checked={clearAddress} onChange={e => {
              setClearAddress(e.target.checked); if (e.target.checked) setEditAddress(false)
            }} />Remove saved address
          </label>}
          <button type="button" onClick={() => void saveContact()} disabled={saving}
            className="bg-navy text-white rounded-xl px-5 py-3 text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save contact details'}
          </button>
        </div>}
      </div>


      <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 flex items-start gap-3">
        <i className="ti ti-info-circle text-gold text-[18px] mt-0.5 flex-shrink-0" aria-hidden="true" />
        <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed">
          To change your account name or email address, contact the parish office. Contact details can be updated above.
        </p>
      </div>
    </div>
  )
}
