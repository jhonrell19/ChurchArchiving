'use client'

import { useEffect, useState } from 'react'
import type { AdminPage } from '../types.ts'
import { CERT_RECORDS, CERT_ICONS, INCOMING_REQUESTS, MASSES_LIST, STATUS_STYLE } from '../data/mockData'

type ArchiveStats = {
  totalRecords: number
  baptismal: number
  marriage: number
  confirmation: number
  death: number
  generatedCertificates: number
}

export default function DashboardHome({ setPage }: { setPage: (p: AdminPage) => void }) {
  const [stats, setStats] = useState<ArchiveStats | null>(null)

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/archive/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err))
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
      label: 'Death Records',
      value: stats?.death ?? 0,
      icon: 'ti-candle',
      color: 'text-red-600 bg-red-50 border-red-200',
    },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {realStats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white border border-gold/20 rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${color}`}>
              <i className={`ti ${icon} text-[17px]`} aria-hidden="true" />
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

          <div className="space-y-3">
            {INCOMING_REQUESTS.slice(0, 4).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gold/10 last:border-0">
                <div className="flex items-center gap-2">
                  <i className={`ti ${CERT_ICONS[r.type]} text-gold text-[15px]`} aria-hidden="true" />
                  <div>
                    <p className="font-display text-navy-mid text-[12px] font-semibold">
                      {r.requester}
                    </p>
                    <p className="font-body text-[#9ab0c4] text-[11px]">
                      {r.type} · {r.refNo}
                    </p>
                  </div>
                </div>

                <span className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
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

          <div className="space-y-3">
            {MASSES_LIST.filter(m => m.status !== 'Transcribed').slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gold/10 last:border-0">
                <div>
                  <p className="font-display text-navy-mid text-[12px] font-semibold">
                    {m.title}
                  </p>
                  <p className="font-body text-[#9ab0c4] text-[11px]">
                    {m.priest} · {m.date}
                  </p>
                </div>

                <span className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status]}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(CERT_RECORDS) as (keyof typeof CERT_RECORDS)[]).map(type => (
          <button
            key={type}
            onClick={() => setPage('archives')}
            className="bg-white border border-gold/20 rounded-xl p-4 flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <i className={`ti ${CERT_ICONS[type]} text-gold text-[17px]`} aria-hidden="true" />
            </div>

            <div>
              <p className="font-display text-navy-mid text-[11px] font-semibold">
                {type}
              </p>
              <p className="font-body text-[#9ab0c4] text-[11px]">
                {CERT_RECORDS[type].length} records
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}