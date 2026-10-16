'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CemeteryPayment, CemeteryReservation } from '../types'

const peso = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value || 0)

export default function PaymentsPage() {
  const [reservations, setReservations] = useState<CemeteryReservation[]>([])
  const [payments, setPayments] = useState<CemeteryPayment[]>([])
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    amount: '',
    paymentType: 'INSTALLMENT',
    paymentMethod: 'CASH',
    receiptNumber: '',
    paymentDate: '',
    notes: '',
  })

  const selectedReservation = useMemo(() => reservations.find(item => item.id === Number(selected)) || null, [reservations, selected])

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/backend/api/cemetery/reservations', { cache: 'no-store' }),
      fetch('/api/backend/api/cemetery/payments', { cache: 'no-store' }),
    ])
    const d1 = await r1.json().catch(() => ({}))
    const d2 = await r2.json().catch(() => ({}))
    if (!r1.ok) throw new Error(d1.error || d1.message || 'Failed to load reservations.')
    if (!r2.ok) throw new Error(d2.error || d2.message || 'Failed to load payments.')
    setReservations(d1.reservations || [])
    setPayments(d2.payments || [])
  }

  useEffect(() => {
    void load().catch(error => setMessage(error.message))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedReservation) return
    const response = await fetch(`/api/backend/api/cemetery/reservations/${selectedReservation.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.error || data.message || 'Unable to record payment.')
      return
    }
    setForm({ amount: '', paymentType: 'INSTALLMENT', paymentMethod: 'CASH', receiptNumber: '', paymentDate: '', notes: '' })
    setMessage('Payment recorded successfully.')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-mid">Payment Management</h1>
        <p className="mt-1 text-sm text-slate-600">Record cash/GCash receipts, down payments, installments, full payments, perpetual dues, and interment fees.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-mid">Record Payment</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select required className="rounded-xl border border-slate-200 px-3 py-2 xl:col-span-2" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Select reservation *</option>
            {reservations.map(item => <option key={item.id} value={item.id}>{item.buyerName} — {item.slot?.slotCode || 'No slot'} — Balance {peso(item.balance)}</option>)}
          </select>
          <input required type="number" min="1" className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Amount *" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <select className="rounded-xl border border-slate-200 px-3 py-2" value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value })}>
            <option value="RESERVATION_FEE">Reservation Fee</option>
            <option value="DOWN_PAYMENT">Down Payment</option>
            <option value="INSTALLMENT">Installment</option>
            <option value="FULL_PAYMENT">Full Payment</option>
            <option value="PERPETUAL_DUES">Perpetual Dues</option>
            <option value="INTERMENT_FEE">Interment Fee</option>
            <option value="OTHER">Other</option>
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="OTHER">Other</option>
          </select>
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Receipt number" value={form.receiptNumber} onChange={e => setForm({ ...form, receiptNumber: e.target.value })} />
          <input type="date" className="rounded-xl border border-slate-200 px-3 py-2" value={form.paymentDate} onChange={e => setForm({ ...form, paymentDate: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2 xl:col-span-2" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white">Record Payment</button>
        </form>
        {selectedReservation && (
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <div><p className="text-[10px] uppercase text-slate-400">Total</p><p className="font-semibold text-navy-mid">{peso(selectedReservation.totalPrice)}</p></div>
            <div><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="font-semibold text-emerald-700">{peso(selectedReservation.amountPaid)}</p></div>
            <div><p className="text-[10px] uppercase text-slate-400">Balance</p><p className="font-semibold text-amber-700">{peso(selectedReservation.balance)}</p></div>
          </div>
        )}
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-mid">Payment History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Reservation</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Receipt</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 text-slate-600">{payment.paymentDate || '—'}</td>
                  <td className="px-3 py-3 text-navy-mid">#{payment.reservationId}</td>
                  <td className="px-3 py-3 text-slate-600">{payment.paymentType.split('_').join(' ')}</td>
                  <td className="px-3 py-3 text-slate-600">{payment.paymentMethod}</td>
                  <td className="px-3 py-3 text-slate-600">{payment.receiptNumber || '—'}</td>
                  <td className="px-3 py-3 text-right font-semibold text-navy-mid">{peso(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="py-4 text-sm text-slate-500">No payment records yet.</p>}
        </div>
      </section>
    </div>
  )
}
