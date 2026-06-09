'use client'

import { useEffect, useState } from 'react'
import type { Page } from '../types'

type MassRecord = {
  id: number
  title: string
  priest: string
  category: string
  date: string
  duration: string
  status: string
  filepath: string | null
  hasTranscript: boolean
}

type Announcement = {
  id: number
  title: string
  category: string
  date: string
  body: string
}

type LatestTranscription = {
  id: number
  massTitle: string
  summaryText: string
} | null

type DashboardSummary = {
  stats: {
    totalArchivedMasses: number
    aiTranscriptions: number
    sermonSummaries: number
    thisMonthUploads: number
  }
  recentMasses: MassRecord[]
  announcements: Announcement[]
  latestTranscription: LatestTranscription
}

export default function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    try {
      setLoading(true)

      const res = await fetch('http://127.0.0.1:5000/api/user/dashboard-summary')

      if (!res.ok) {
        throw new Error('Failed to load dashboard')
      }

      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('Dashboard load error:', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const stats = [
    {
      label: 'Total Archived Masses',
      value: data?.stats.totalArchivedMasses ?? 0,
      icon: 'ti-video',
    },
    {
      label: 'AI Transcriptions',
      value: data?.stats.aiTranscriptions ?? 0,
      icon: 'ti-file-text',
    },
    {
      label: 'Sermon Summaries',
      value: data?.stats.sermonSummaries ?? 0,
      icon: 'ti-sparkles',
    },
    {
      label: "This Month's Uploads",
      value: data?.stats.thisMonthUploads ?? 0,
      icon: 'ti-calendar-month',
    },
  ]

  if (loading) {
    return (
      <div>
        <p className="font-body text-[#9ab0c4] text-[14px]">
          Loading dashboard content...
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-gold/20 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-3">
              <i className={`ti ${icon} text-gold text-[17px]`} />
            </div>

            <p className="font-display text-[22px] font-semibold text-navy-mid leading-none mb-1">
              {value}
            </p>

            <p className="font-body text-[12px] text-[#6b8caa] leading-tight">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-navy-mid text-[15px] font-semibold">
              Recent Masses
            </h3>

            <button
              onClick={() => setPage('archives')}
              className="font-display text-[11px] tracking-wider text-gold border border-gold/30 px-3 py-1 rounded-lg"
            >
              View All
            </button>
          </div>

          {!data || data.recentMasses.length === 0 ? (
            <div className="bg-white border border-gold/20 rounded-xl p-10 text-center">
              <i className="ti ti-video-off text-gold/30 text-4xl mb-3 block" />
              <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
                No masses uploaded yet
              </p>
              <p className="font-body text-[#9ab0c4] text-[13px]">
                Mass records will appear here after the admin uploads or adds them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.recentMasses.map(m => (
                <div key={m.id} className="bg-white border border-gold/20 rounded-xl overflow-hidden">
                  <div className="h-28 bg-navy flex items-center justify-center relative">
                    <i className="ti ti-player-play text-gold text-3xl" />

                    {m.hasTranscript && (
                      <span className="absolute top-3 right-3 font-display text-[10px] tracking-wider bg-gold text-navy px-2 py-1 rounded-full">
                        AI Transcript
                      </span>
                    )}

                    <span className="absolute bottom-3 right-3 font-body text-[10px] text-gold/70">
                      {m.duration || 'No duration'}
                    </span>
                  </div>

                  <div className="p-4">
                    <p className="font-display text-navy-mid text-[13px] font-semibold mb-1">
                      {m.title}
                    </p>

                    <p className="font-body text-[#6b8caa] text-[12px] mb-3">
                      {m.priest || 'No priest assigned'}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-[10px] tracking-wider border border-gold/25 text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                        {m.category || 'General'}
                      </span>

                      <span className="font-body text-[11px] text-[#9ab0c4]">
                        {m.date || 'No date'}
                      </span>
                    </div>

                    {m.filepath && (
                      <a
                        href={`http://127.0.0.1:5000/files/${m.filepath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 font-display text-[10px] tracking-wider text-gold border border-gold/30 px-3 py-1.5 rounded-lg bg-gold/5"
                      >
                        <i className="ti ti-player-play text-[13px]" />
                        View Recording
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-navy-mid text-[15px] font-semibold">
                Announcements
              </h3>

              <button
                onClick={() => setPage('announcements')}
                className="font-display text-[11px] tracking-wider text-gold"
              >
                See all
              </button>
            </div>

            {!data || data.announcements.length === 0 ? (
              <div className="bg-white border border-gold/20 rounded-xl p-5">
                <p className="font-body text-[#9ab0c4] text-[13px]">
                  No announcements posted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.announcements.map(a => (
                  <div key={a.id} className="bg-white border border-gold/20 rounded-xl p-4">
                    <p className="font-display text-navy-mid text-[12px] font-semibold leading-snug mb-1">
                      {a.title}
                    </p>

                    <p className="font-body text-[11px] text-[#9ab0c4]">
                      {a.date || 'No date'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-navy-mid text-[15px] font-semibold">
                Latest Transcription
              </h3>

              <button
                onClick={() => setPage('transcriptions')}
                className="font-display text-[11px] tracking-wider text-gold"
              >
                See all
              </button>
            </div>

            {!data?.latestTranscription ? (
              <div className="bg-white border border-gold/20 rounded-xl p-4">
                <p className="font-body text-[#9ab0c4] text-[13px]">
                  No transcriptions available yet.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gold/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ti ti-sparkles text-gold text-[15px]" />
                  <p className="font-display text-navy-mid text-[12px] font-semibold">
                    {data.latestTranscription.massTitle}
                  </p>
                </div>

                <p className="font-body text-[12px] text-[#6b8caa] italic leading-relaxed line-clamp-3">
                  "{data.latestTranscription.summaryText || 'No summary available.'}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}