'use client'

import { useEffect, useState } from 'react'

type UserProfile = {
  id: number
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
  if (role === 'admin') return 'Administrator'
  if (role === 'guest') return 'Parishioner / Guest User'
  return role
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
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me')

        if (!res.ok) {
          throw new Error('Failed to load profile')
        }

        const data = await res.json()
        setUser(data.user)
      } catch (err) {
        console.error('Profile load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  if (loading) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
          My Profile
        </h2>
        <p className="font-body text-[#6b8caa] text-[14px] mb-6">
          Loading your account information...
        </p>

        <div className="bg-white border border-gold/20 rounded-xl p-6">
          <p className="font-body text-[#9ab0c4] text-[13px]">
            Please wait...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg">
        <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
          My Profile
        </h2>
        <p className="font-body text-[#6b8caa] text-[14px] mb-6">
          Your account information and preferences.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-body text-red-600 text-[13px]">
            Unable to load profile. Please log in again.
          </p>
        </div>
      </div>
    )
  }

  const fields = [
    {
      label: 'Email',
      value: user.email,
      icon: 'ti-mail',
    },
    {
      label: 'User ID',
      value: `#${user.id}`,
      icon: 'ti-id',
    },
    {
      label: 'Role',
      value: formatRole(user.role),
      icon: 'ti-shield',
    },
    {
      label: 'Joined',
      value: formatDate(user.createdAt),
      icon: 'ti-calendar',
    },
  ]

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        My Profile
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Your account information and preferences.
      </p>

      <div className="bg-white border border-gold/20 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-navy border-2 border-gold/30 flex items-center justify-center">
            <span className="font-display text-gold text-xl font-semibold">
              {getInitials(user.fullName)}
            </span>
          </div>

          <div>
            <p className="font-display text-navy-mid text-[15px] font-semibold">
              {user.fullName}
            </p>

            <p className="font-body text-[#6b8caa] text-[13px]">
              {formatRole(user.role)} · Member since {new Date(user.createdAt).getFullYear()}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-gold/10 pt-4">
          {fields.map(({ label, value, icon }) => (
            <div key={label} className="flex items-center gap-3">
              <i
                className={`ti ${icon} text-gold text-[16px] w-5`}
                aria-hidden="true"
              />

              <span className="font-body text-[13px] text-[#6b8caa] w-20">
                {label}
              </span>

              <span className="font-body text-[13px] text-navy-mid">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 flex items-start gap-3">
        <i
          className="ti ti-info-circle text-gold text-[18px] mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />

        <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed">
          Your profile information is based on the account used during login.
          To request changes, please contact the parish office.
        </p>
      </div>
    </div>
  )
}