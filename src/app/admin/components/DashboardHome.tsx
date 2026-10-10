'use client'

import { useEffect, useState } from 'react'
import type { AdminPage } from '../types.ts'
import { CERT_ICONS, STATUS_STYLE } from '../data/mockData'

type ArchiveStats = {
  totalRecords: number
  baptismal: number
  marriage: number
  confirmation: number
  generatedCertificates: number
}

type CertificateRequest = {
  id: number
  requesterName: string
  sacramentType: string
  personName: string
  purpose: string
  status: string
  createdAt: string
}

type MassRecord = {
  id: number
  title: string
  priest: string
  date: string
  duration: string
  status: string
  category: string
}

const getDisplayType = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1)

const getCertIconKey = (type: string) => getDisplayType(type)

export default function DashboardHome({ setPage }: { setPage: (p: AdminPage) => void }) {
  const [stats, setStats] = useState<ArchiveStats | null>(null)
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [masses, setMasses] = useState<MassRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const [statsRes, requestsRes, massesRes] = await Promise.all([
        fetch('/api/backend/api/archive/stats'),
        fetch('/api/backend/api/requests'),
        fetch('/api/backend/api/masses'),
      ])

      const statsData = statsRes.ok ? await statsRes.json() : null
      const requestsData = requestsRes.ok ? await requestsRes.json() : { requests: [] }
      const massesData = massesRes.ok ? await massesRes.json() : { masses: [] }

      setStats(statsData)
      setRequests(requestsData.requests || [])
      setMasses(massesData.masses || [])
    } catch (err) {
      console.error('Admin dashboard load error:', err)
      setStats(null)
      setRequests([])
      setMasses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const realStats = [
    {
      label: 'Total Records',
      value: stats?.totalRecords ?? 0,
      icon: 'ti-archive',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      label: 'Baptismal Records',
      value: stats?.baptismal ?? 0,
      icon: 'ti-droplet',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      label: 'Marriage Records',
      value: stats?.marriage ?? 0,
      icon: 'ti-rings',
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    {
      label: 'Confirmation Records',
      value: stats?.confirmation ?? 0,
      icon: 'ti-shield-check',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
  ]

  const latestRequests = requests.slice(0, 4)

  const pendingMasses = masses
    .filter(m => m.status !== 'Transcribed')
    .slice(0, 4)

  const archiveCards = [
  {
    type: 'Baptismal',
    count: stats?.baptismal ?? 0,
    icon: 'ti-droplet',
  },
  {
    type: 'Confirmation',
    count: stats?.confirmation ?? 0,
    icon: 'ti-shield-check',
  },
  {
    type: 'Marriage',
    count: stats?.marriage ?? 0,
    icon: 'ti-rings',
  },
]

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {realStats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white border border-gold/20 rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${color}`}>
              <i className={`ti ${icon} text-[17px]`} />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gold/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-navy-mid text-[14px] font-semibold">
              Latest Incoming Requests
            </h3>

            <button
              onClick={() => setPage('requests')}
              className="font-display text-[11px] tracking-wider text-gold"
            >
              View all
            </button>
          </div>

          {loading ? (
            <p className="font-body text-[#9ab0c4] text-[13px] py-6 text-center">
              Loading requests...
            </p>
          ) : latestRequests.length === 0 ? (
            <p className="font-body text-[#9ab0c4] text-[13px] py-6 text-center">
              No incoming requests yet.
            </p>
          ) : (
            <div className="space-y-3">
              {latestRequests.map(r => {
                const displayType = getDisplayType(r.sacramentType)
                const iconKey = getCertIconKey(r.sacramentType) as keyof typeof CERT_ICONS

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 border-b border-gold/10 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <i
                        className={`ti ${
                          CERT_ICONS[iconKey] || 'ti-file-certificate'
                        } text-gold text-[15px]`}
                      />

                      <div>
                        <p className="font-display text-navy-mid text-[12px] font-semibold">
                          {r.requesterName}
                        </p>

                        <p className="font-body text-[#9ab0c4] text-[11px]">
                          {displayType} · IFI-REQ-{r.id.toString().padStart(4, '0')}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${
                        STATUS_STYLE[r.status] || 'bg-white text-[#9ab0c4] border-gold/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gold/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-navy-mid text-[14px] font-semibold">
              Masses Pending Transcription
            </h3>

            <button
              onClick={() => setPage('masses')}
              className="font-display text-[11px] tracking-wider text-gold"
            >
              View all
            </button>
          </div>

          {loading ? (
            <p className="font-body text-[#9ab0c4] text-[13px] py-6 text-center">
              Loading mass records...
            </p>
          ) : pendingMasses.length === 0 ? (
            <p className="font-body text-[#9ab0c4] text-[13px] py-6 text-center">
              No masses pending transcription.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingMasses.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b border-gold/10 last:border-0"
                >
                  <div>
                    <p className="font-display text-navy-mid text-[12px] font-semibold">
                      {m.title}
                    </p>

                    <p className="font-body text-[#9ab0c4] text-[11px]">
                      {m.priest || 'No priest'} · {m.date || 'No date'}
                    </p>
                  </div>

                  <span
                    className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[m.status] || 'bg-white text-[#9ab0c4] border-gold/20'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {archiveCards.map(card => (
          <button
            key={card.type}
            onClick={() => setPage('archives')}
            className="bg-white border border-gold/20 rounded-xl p-4 flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <i className={`ti ${card.icon} text-gold text-[17px]`} />
            </div>

            <div>
              <p className="font-display text-navy-mid text-[11px] font-semibold">
                {card.type}
              </p>

              <p className="font-body text-[#9ab0c4] text-[11px]">
                {card.count} records
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}