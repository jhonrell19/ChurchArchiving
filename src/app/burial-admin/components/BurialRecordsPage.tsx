'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { BurialRecord, CemeterySlot } from '../types'

export default function BurialRecordsPage() {
  const [slots, setSlots] = useState<CemeterySlot[]>([])
  const [records, setRecords] = useState<BurialRecord[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    deceasedName: '',
    burialDate: '',
    deathCertificateNumber: '',
    slotId: '',
    notes: '',
  })
  const [deathCertificate, setDeathCertificate] = useState<File | null>(null)
  const [burialPermit, setBurialPermit] = useState<File | null>(null)
  const [authorization, setAuthorization] = useState<File | null>(null)

  const selectedSlot = useMemo(() => slots.find(slot => slot.id === Number(form.slotId)) || null, [slots, form.slotId])

  const load = async () => {
    const [slotResponse, burialResponse] = await Promise.all([
      fetch('/api/backend/api/cemetery/slots', { cache: 'no-store' }),
      fetch(`/api/backend/api/cemetery/burials${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`, { cache: 'no-store' }),
    ])
    const slotData = await slotResponse.json().catch(() => ({}))
    const burialData = await burialResponse.json().catch(() => ({}))
    if (!slotResponse.ok) throw new Error(slotData.error || slotData.message || 'Failed to load cemetery slots.')
    if (!burialResponse.ok) throw new Error(burialData.error || burialData.message || 'Failed to load burial records.')
    setSlots(slotData.slots || [])
    setRecords(burialData.burials || [])
  }

  useEffect(() => {
    void load().catch(error => setMessage(error.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const body = new FormData()
    body.append('deceased_name', form.deceasedName)
    body.append('burial_date', form.burialDate)
    body.append('death_certificate_number', form.deathCertificateNumber)
    body.append('slot_id', form.slotId)
    body.append('notes', form.notes)
    if (deathCertificate) body.append('death_certificate', deathCertificate)
    if (burialPermit) body.append('burial_permit', burialPermit)
    if (authorization) body.append('authorization', authorization)

    const response = await fetch('/api/backend/api/cemetery/burials', {
      method: 'POST',
      body,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.error || data.message || 'Unable to create burial record.')
      return
    }

    setForm({ deceasedName: '', burialDate: '', deathCertificateNumber: '', slotId: '', notes: '' })
    setDeathCertificate(null)
    setBurialPermit(null)
    setAuthorization(null)
    setMessage('Burial record saved.')
    await load()
  }

  const protectedFile = (path: string | null) =>
    path ? `/api/backend/api/cemetery/files/${path}` : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-mid">Burial Records</h1>
        <p className="mt-1 text-sm text-slate-600">Encode the deceased information taken from the death certificate and connect the burial to its cemetery location.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-mid">New Burial Record</h2>
        <p className="mt-1 text-xs text-slate-500">A death certificate is the primary information source. If a slot already contains a burial, an authorization document is required before another interment can be recorded there.</p>
        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input required className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Deceased name *" value={form.deceasedName} onChange={e => setForm({ ...form, deceasedName: e.target.value })} />
          <input type="date" className="rounded-xl border border-slate-200 px-3 py-2" value={form.burialDate} onChange={e => setForm({ ...form, burialDate: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Death certificate no." value={form.deathCertificateNumber} onChange={e => setForm({ ...form, deathCertificateNumber: e.target.value })} />
          <select required className="rounded-xl border border-slate-200 px-3 py-2 xl:col-span-2" value={form.slotId} onChange={e => setForm({ ...form, slotId: e.target.value })}>
            <option value="">Select cemetery slot *</option>
            {slots.map(slot => <option key={slot.id} value={slot.id}>{slot.slotCode} — {slot.status} — {slot.burialCount} burial(s)</option>)}
          </select>
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

          <label className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
            <span className="block text-xs font-semibold text-navy-mid">Death Certificate</span>
            <input type="file" className="mt-2 block w-full text-xs" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setDeathCertificate(e.target.files?.[0] || null)} />
          </label>
          <label className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
            <span className="block text-xs font-semibold text-navy-mid">Burial Permit (if provided)</span>
            <input type="file" className="mt-2 block w-full text-xs" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setBurialPermit(e.target.files?.[0] || null)} />
          </label>
          <label className={`rounded-xl border border-dashed p-3 text-sm ${selectedSlot?.burialCount ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-600'}`}>
            <span className="block text-xs font-semibold text-navy-mid">Authorization for reused slot</span>
            <input type="file" className="mt-2 block w-full text-xs" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setAuthorization(e.target.files?.[0] || null)} />
            {selectedSlot?.burialCount ? <span className="mt-1 block text-[11px]">Required: this slot already contains a burial record.</span> : null}
          </label>

          <button className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white">Save Burial Record</button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold text-navy-mid">Search Burial Records</h2>
          <div className="flex gap-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Name, lot, holder..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Search</button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {records.map(record => (
            <article key={record.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy-mid">{record.deceasedName}</p>
                  <p className="text-xs text-slate-500">Buried {record.burialDate || 'date not recorded'} · {record.slot?.slotCode || 'No slot'}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold">{record.status}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Death certificate</dt><dd className="text-right text-navy-mid">{record.deathCertificateNumber || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Lot holder</dt><dd className="text-right text-navy-mid">{record.slot?.rightsHolderName || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Block / Lot</dt><dd className="text-right text-navy-mid">{record.slot?.block || '—'} / {record.slot?.lotNumber || '—'}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {protectedFile(record.deathCertificateFile) && <a className="text-gold underline" target="_blank" href={protectedFile(record.deathCertificateFile)!}>Death certificate</a>}
                {protectedFile(record.burialPermitFile) && <a className="text-gold underline" target="_blank" href={protectedFile(record.burialPermitFile)!}>Burial permit</a>}
                {protectedFile(record.authorizationFile) && <a className="text-gold underline" target="_blank" href={protectedFile(record.authorizationFile)!}>Authorization</a>}
              </div>
            </article>
          ))}
          {records.length === 0 && <p className="text-sm text-slate-500">No burial records yet.</p>}
        </div>
      </section>
    </div>
  )
}
