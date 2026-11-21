'use client'

import { useEffect, useState } from 'react'
import ParishCalendar from '../../components/ParishCalendar'
import { BADGE_COLOR } from '../data/ui'

type Announcement = {
  id: number
  title: string
  category: string
  date: string
  body: string
  imagePath?: string
  starts?: string
  ends?: string
  createdAt: string
}

import type {Service} from '@/lib/siteContent'
export default function AnnouncementsPage({services}:{services:Service[]}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const [failed, setFailed] = useState(false)

  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      setFailed(false)

      const res = await fetch('/api/backend/api/announcements')

      if (!res.ok) {
        throw new Error('Failed to load announcements')
      }

      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (err) {
      console.warn('Load announcements error:', err)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadAnnouncements())
  }, [])

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Parish Announcements
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Latest updates and announcements from the parish.
      </p>

      {!loading && !failed && <ParishCalendar notices={announcements} services={services} />}
      {loading ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <p className="font-body text-[#9ab0c4] text-[14px]">
            Loading announcements...
          </p>
        </div>
      ) : failed ? (
        <div role="alert">
          <p>Parish notices could not be loaded.</p>
          <button className="underline" onClick={() => void loadAnnouncements()}>Try again</button>
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
              {a.imagePath && <img src={a.imagePath} alt="" className="mb-4 h-44 w-full object-cover rounded-lg"/>}
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
                {a.date || a.createdAt?.slice(0, 10) || 'No date'}{a.ends && ' · Notice ends ' + a.ends}
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