'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CemeteryReservation, CemeterySlot } from '../types'

type PaymentPlan = 'CASH' | 'DOWNPAYMENT' | 'INSTALLMENT'

const peso = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0)

const initialForm = {
  raNumber: '',
  reservationDate: '',
  buyerName: '',
  buyerAddress: '',
  buyerContact: '',
  civilStatus: '',
  spouseName: '',
  slotId: '',
  paymentPlan: 'CASH' as PaymentPlan,
  totalPrice: '',
  reservationFee: '',
  requiredDownPayment: '',
  termMonths: '',
  dueDate: '',
  notes: '',
}

const fieldClass = 'w-full rounded-xl border border-slate-200 px-3 py-2'

export default function ReservationsPage() {
  const [slots, setSlots] = useState<CemeterySlot[]>([])
  const [reservations, setReservations] = useState<CemeteryReservation[]>([])
  const [form, setForm] = useState({ ...initialForm })
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const availableSlots = useMemo(() => slots.filter(slot => slot.status === 'AVAILABLE'), [slots])
  const totalPrice = Number(form.totalPrice || 0)
  const plannedDownPayment = form.paymentPlan === 'CASH' ? 0 : Number(form.requiredDownPayment || 0)

  const changePaymentPlan = (paymentPlan: PaymentPlan) => {
    setForm(previous => ({
      ...previous,
      paymentPlan,
      // Hidden fields should NEVER leave stale values in a new reservation.
      requiredDownPayment: '',
      termMonths: '',
      dueDate: '',
    }))
  }

  const load = async () => {
    const [slotsResponse, reservationsResponse] = await Promise.all([
      fetch('/api/backend/api/cemetery/slots', { cache: 'no-store' }),
      fetch(`/api/backend/api/cemetery/reservations${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`, { cache: 'no-store' }),
    ])
    const slotsData = await slotsResponse.json().catch(() => ({}))
    const reservationsData = await reservationsResponse.json().catch(() => ({}))
    if (!slotsResponse.ok) throw new Error(slotsData.error || slotsData.message || 'Failed to load cemetery slots.')
    if (!reservationsResponse.ok) throw new Error(reservationsData.error || reservationsData.message || 'Failed to load reservations.')
    setSlots(slotsData.slots || [])
    setReservations(reservationsData.reservations || [])
  }

  useEffect(() => {
    void load().catch(error => setMessage(error.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      setMessage('Enter a total lot price greater than zero.')
      return
    }
    if (form.paymentPlan !== 'CASH' && plannedDownPayment > totalPrice) {
      setMessage('Required down payment cannot exceed the total lot price.')
      return
    }
    if (form.paymentPlan === 'DOWNPAYMENT' && plannedDownPayment <= 0) {
      setMessage('Enter the agreed required down payment.')
      return
    }
    if (form.paymentPlan === 'INSTALLMENT' && Number(form.termMonths) <= 0) {
      setMessage('Enter the number of months for the installment arrangement.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/backend/api/cemetery/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slotId: Number(form.slotId),
          totalPrice,
          reservationFee: Number(form.reservationFee || 0),
          requiredDownPayment: form.paymentPlan === 'CASH' ? 0 : plannedDownPayment,
          termMonths: form.paymentPlan === 'INSTALLMENT' ? Number(form.termMonths) : null,
          dueDate: form.paymentPlan === 'CASH' ? null : form.dueDate || null,
          // Intentionally no monthlyAmortization: it is retired from new records.
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || 'Unable to create reservation.')
      setForm({ ...initialForm })
      setMessage('Reservation saved. Record any money actually received under Payment Management.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create reservation.')
    } finally {
      setSaving(false)
    }
  }

  const uploadContract = async (reservationId: number, file: File | null) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    const response = await fetch(`/api/backend/api/cemetery/reservations/${reservationId}/contract`, {
      method: 'POST',
      body,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.error || data.message || 'Unable to upload contract.')
      return
    }
    setMessage('Reservation contract uploaded.')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-mid">Reservations & Contracts</h1>
        <p className="mt-1 text-sm text-slate-600">Encode the reservation/application contract and connect it to a confirmed cemetery slot.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-mid">New Reservation</h2>
        <p className="mt-1 text-xs text-slate-500">Enter the agreed lot price and payment arrangement. Prices are not automatically set from example contracts.</p>
        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className={fieldClass} placeholder="R.A. No." value={form.raNumber} onChange={e => setForm({ ...form, raNumber: e.target.value })} />
          <input type="date" aria-label="Reservation date" className={fieldClass} value={form.reservationDate} onChange={e => setForm({ ...form, reservationDate: e.target.value })} />
          <input required className={fieldClass} placeholder="Buyer name *" value={form.buyerName} onChange={e => setForm({ ...form, buyerName: e.target.value })} />
          <input className={`${fieldClass} xl:col-span-2`} placeholder="Buyer address" value={form.buyerAddress} onChange={e => setForm({ ...form, buyerAddress: e.target.value })} />
          <input className={fieldClass} placeholder="Contact number" value={form.buyerContact} onChange={e => setForm({ ...form, buyerContact: e.target.value })} />
          <input className={fieldClass} placeholder="Civil status" value={form.civilStatus} onChange={e => setForm({ ...form, civilStatus: e.target.value })} />
          <input className={fieldClass} placeholder="Spouse name (if married)" value={form.spouseName} onChange={e => setForm({ ...form, spouseName: e.target.value })} />
          <select required aria-label="Available cemetery slot" className={fieldClass} value={form.slotId} onChange={e => setForm({ ...form, slotId: e.target.value })}>
            <option value="">Select available slot *</option>
            {availableSlots.map(slot => <option key={slot.id} value={slot.id}>{slot.slotCode} — {slot.section || 'No section'} / Block {slot.block || '—'} / Lot {slot.lotNumber}</option>)}
          </select>

          <div className="md:col-span-2 xl:col-span-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-navy-mid">Payment Arrangement</h3>
            <p className="mt-1 text-xs text-slate-500">Selecting a payment plan changes the required fields. It does not record a payment.</p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Payment plan *
            <select className={fieldClass} value={form.paymentPlan} onChange={e => changePaymentPlan(e.target.value as PaymentPlan)}>
              <option value="CASH">Cash / Full Payment</option>
              <option value="DOWNPAYMENT">Down Payment</option>
              <option value="INSTALLMENT">Installment</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Total lot price *
            <input required type="number" min="1" step="1" className={fieldClass} placeholder="Total lot price" value={form.totalPrice} onChange={e => setForm({ ...form, totalPrice: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Reservation fee (if applicable)
            <input type="number" min="0" step="1" className={fieldClass} placeholder="Reservation fee" value={form.reservationFee} onChange={e => setForm({ ...form, reservationFee: e.target.value })} />
          </label>

          {form.paymentPlan !== 'CASH' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Required down payment {form.paymentPlan === 'DOWNPAYMENT' ? '*' : '(optional)'}
              <input required={form.paymentPlan === 'DOWNPAYMENT'} type="number" min={form.paymentPlan === 'DOWNPAYMENT' ? '1' : '0'} step="1" className={fieldClass} placeholder="Agreed down payment" value={form.requiredDownPayment} onChange={e => setForm({ ...form, requiredDownPayment: e.target.value })} />
            </label>
          )}
          {form.paymentPlan === 'INSTALLMENT' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Payment term (months) *
              <input required type="number" min="1" step="1" className={fieldClass} placeholder="Months to pay" value={form.termMonths} onChange={e => setForm({ ...form, termMonths: e.target.value })} />
            </label>
          )}
          {form.paymentPlan !== 'CASH' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {form.paymentPlan === 'DOWNPAYMENT' ? 'Balance due date (optional)' : 'Next payment due date (optional)'}
              <input type="date" className={fieldClass} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </label>
          )}

          {totalPrice > 0 && (
            <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-navy-mid">Agreement Preview</p>
              <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-700">
                <span>Lot price: <strong>{peso(totalPrice)}</strong></span>
                {form.paymentPlan === 'CASH' ? (
                  <span>Planned payment: <strong>Full amount</strong></span>
                ) : (
                  <>
                    <span>Agreed down payment: <strong>{peso(plannedDownPayment)}</strong></span>
                    <span>Remaining after planned down payment: <strong>{peso(Math.max(0, totalPrice - plannedDownPayment))}</strong></span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">This is a payment arrangement, not a receipt. Reservation fees and actual payments must be handled separately in Payment Management.</p>
            </div>
          )}
          <input className={`${fieldClass} md:col-span-2 xl:col-span-3`} placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button disabled={saving} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Create Reservation'}</button>
        </form>
        {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold text-navy-mid">Reservation Records</h2>
          <div className="flex gap-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buyer, R.A. no., lot..." />
            <button onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Search</button>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {reservations.map(item => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-semibold text-navy-mid">{item.buyerName}</p>
                  <p className="text-xs text-slate-500">{item.raNumber || `Reservation #${item.id}`} · {item.slot?.slotCode || 'No slot'} · {item.paymentPlan}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.buyerAddress || 'No address'} {item.buyerContact ? `· ${item.buyerContact}` : ''}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right">
                  <div><p className="text-[10px] uppercase text-slate-400">Price</p><p className="font-semibold text-navy-mid">{peso(item.totalPrice)}</p></div>
                  <div><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="font-semibold text-emerald-700">{peso(item.amountPaid)}</p></div>
                  <div><p className="text-[10px] uppercase text-slate-400">Balance</p><p className="font-semibold text-amber-700">{peso(item.balance)}</p></div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded-full border border-slate-200 px-2.5 py-1">{item.paymentStatus.split('_').join(' ')}</span>
                {item.dueDate && <span className="text-slate-500">Due: {item.dueDate}</span>}
                {item.termMonths && <span className="text-slate-500">Term: {item.termMonths} months</span>}
                {item.contractFile ? (
                  <a className="text-gold underline" target="_blank" rel="noopener noreferrer" href={`/api/backend/api/cemetery/files/${item.contractFile}`}>View contract</a>
                ) : (
                  <label className="cursor-pointer text-gold underline">
                    Upload contract
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => void uploadContract(item.id, e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </article>
          ))}
          {reservations.length === 0 && <p className="text-sm text-slate-500">No reservation records yet.</p>}
        </div>
      </section>
    </div>
  )
}
