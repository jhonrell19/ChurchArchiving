'use client'

import { useEffect, useState } from 'react'

type DashboardData = {
  counts: {
    totalSlots: number
    availableSlots: number
    reservedSlots: number
    occupiedSlots: number
    activeReservations: number
    burialRecords: number
    partiallyPaid: number
    unpaid: number
    overdue: number
    outstandingBalance: number
  }
  recentPayments: {
    id: number
    amount: number
    paymentType: string
    paymentDate: string | null
    receiptNumber: string | null
  }[]
  recentReservations: {
    id: number
    buyerName: string
    raNumber: string | null
    balance: number
    paymentStatus: string
    slot?: { slotCode: string } | null
  }[]
}

const peso = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0)

export default function BurialDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/backend/api/cemetery/dashboard', {
          cache: 'no-store',
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || json.message || 'Failed to load cemetery dashboard.')
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cemetery dashboard.')
      }
    }
    void load()
  }, [])

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
  }

  if (!data) {
    return <div className="text-sm text-slate-500">Loading cemetery dashboard...</div>
  }

  const cards = [
    ['Available Slots', data.counts.availableSlots, 'ti-map-pin'],
    ['Reserved Slots', data.counts.reservedSlots, 'ti-bookmark'],
    ['Occupied Slots', data.counts.occupiedSlots, 'ti-cross'],
    ['Active Reservations', data.counts.activeReservations, 'ti-file-text'],
    ['Burial Records', data.counts.burialRecords, 'ti-certificate'],
    ['Partial Payments', data.counts.partiallyPaid, 'ti-receipt'],
    ['Overdue Accounts', data.counts.overdue, 'ti-alert-triangle'],
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-mid">Cemetery Operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Burial records, cemetery slots, reservations, and payment balances in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, icon]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-navy-mid">{value}</p>
              </div>
              <i className={`ti ${icon} text-2xl text-gold`} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Outstanding cemetery balance</p>
        <p className="mt-2 text-3xl font-semibold text-navy-mid">{peso(data.counts.outstandingBalance)}</p>
        <p className="mt-1 text-sm text-slate-600">
          {data.counts.unpaid} unpaid account(s) and {data.counts.partiallyPaid} partially paid account(s).
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-navy-mid">Recent Reservations</h2>
          <div className="mt-4 space-y-3">
            {data.recentReservations.length === 0 && <p className="text-sm text-slate-500">No reservations yet.</p>}
            {data.recentReservations.map(item => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-navy-mid">{item.buyerName}</p>
                    <p className="text-xs text-slate-500">{item.raNumber || `Reservation #${item.id}`} · {item.slot?.slotCode || 'No slot'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-navy-mid">{peso(item.balance)}</p>
                    <p className="text-xs text-slate-500">remaining</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-navy-mid">Recent Payments</h2>
          <div className="mt-4 space-y-3">
            {data.recentPayments.length === 0 && <p className="text-sm text-slate-500">No payments recorded yet.</p>}
            {data.recentPayments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="font-medium text-navy-mid">{payment.paymentType.split('_').join(' ')}</p>
                  <p className="text-xs text-slate-500">{payment.paymentDate || 'No date'} {payment.receiptNumber ? `· ${payment.receiptNumber}` : ''}</p>
                </div>
                <p className="font-semibold text-navy-mid">{peso(payment.amount)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
