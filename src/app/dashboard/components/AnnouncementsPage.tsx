'use client'

import { useEffect, useState } from 'react'
import { BADGE_COLOR } from '../data/mockData'

type Announcement = {
  id: number
  title: string
  category: string
  date: string
  body: string
  createdAt: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const loadAnnouncements = async () => {
    try {
      setLoading(true)

      const res = await fetch('http://127.0.0.1:5000/api/announcements')

      if (!res.ok) {
        throw new Error('Failed to load announcements')
      }

      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (err) {
      console.error('Load announcements error:', err)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Parish Announcements
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Latest updates and announcements from the parish.
      </p>

      {loading ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <p className="font-body text-[#9ab0c4] text-[14px]">
            Loading announcements...
          </p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <i className="ti ti-bell-off text-gold/30 text-5xl mb-3 block" />

          <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
            No announcements yet
          </p>

          <p className="font-body text-[#9ab0c4] text-[13px]">
            Parish announcements will appear here after the admin publishes them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="bg-white border border-gold/20 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="font-display text-navy-mid text-[14px] font-semibold leading-snug">
                  {a.title}
                </p>

                <span
                  className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${
                    BADGE_COLOR[a.category] ?? 'bg-gold/10 text-gold border-gold/25'
                  }`}
                >
                  {a.category || 'General'}
                </span>
              </div>

              <p className="font-body text-[12px] text-[#9ab0c4] mb-3">
                {a.date || a.createdAt?.slice(0, 10) || 'No date'}
              </p>

              <p className="font-body text-[14px] text-[#4a6a8a] leading-relaxed">
                {a.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}