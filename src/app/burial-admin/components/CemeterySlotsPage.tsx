'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { CemeterySlot } from '../types'

const initialForm = {
  section: '',
  block: '',
  lotNumber: '',
  slotCode: '',
  lotType: 'LAWN_LOT',
  mapLabel: '',
  notes: '',
}

export default function CemeterySlotsPage() {
  const [slots, setSlots] = useState<CemeterySlot[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [mapError, setMapError] = useState(false)
  const [mapReload, setMapReload] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSlots = async () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (status) params.set('status', status)
    const response = await fetch(`/api/backend/api/cemetery/slots?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || data.message || 'Failed to load cemetery slots.')
    setSlots(data.slots || [])
  }

  useEffect(() => {
    void loadSlots().catch(error => setMessage(error.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/backend/api/cemetery/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || 'Unable to create cemetery slot.')
      setForm(initialForm)
      setMessage('Cemetery slot saved.')
      await loadSlots()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create cemetery slot.')
    } finally {
      setLoading(false)
    }
  }

  const statusClass = (value: string) => {
    if (value === 'AVAILABLE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (value === 'RESERVED') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-mid">Cemetery Slots</h1>
        <p className="mt-1 text-sm text-slate-600">Encode confirmed lots from the cemetery plan. The photographed map below is a staff reference, not yet a clickable map.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-navy-mid">Site Master Plan Reference</h2>
          <p className="mt-1 text-xs text-slate-500">Use the physical map and cemetery records to confirm section, block, and lot number before encoding.</p>
        </div>
        <div className="max-h-[520px] overflow-auto bg-slate-50 p-3">
          {mapError ? <div className="p-5 text-center text-sm text-amber-800">
            <p>The cemetery map could not load. Check that <code>church_backend/uploads/cemetery/site_master_plan_reference.png</code> is present on the machine running Flask, and that the Burial Admin session is active.</p>
            <button type="button" className="mt-3 rounded-lg bg-navy px-4 py-2 text-white" onClick={()=>{setMapError(false);setMapReload(x=>x+1)}}>Retry map</button>
          </div> : <img key={mapReload} src={`/api/backend/api/cemetery/map?v=${mapReload}`} onError={()=>setMapError(true)} alt="Cemetery site master plan reference" className="mx-auto max-w-full rounded-lg border border-slate-200" />}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-mid">Add Confirmed Slot</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Section (e.g. Saint Peter)" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Block (e.g. B)" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Lot No. *" required value={form.lotNumber} onChange={e => setForm({ ...form, lotNumber: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Slot code (optional)" value={form.slotCode} onChange={e => setForm({ ...form, slotCode: e.target.value })} />
          <select className="rounded-xl border border-slate-200 px-3 py-2" value={form.lotType} onChange={e => setForm({ ...form, lotType: e.target.value })}>
            <option value="LAWN_LOT">Lawn Lot</option>
            <option value="MAUSOLEUM">Mausoleum</option>
            <option value="MULTI_LEVEL_TOMB">Multi-Level Tomb</option>
            <option value="OSSUARY">Ossuary</option>
            <option value="OTHER">Other</option>
          </select>
          <input className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Map label/reference" value={form.mapLabel} onChange={e => setForm({ ...form, mapLabel: e.target.value })} />
          <input className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button disabled={loading} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Saving...' : 'Add Slot'}</button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold text-navy-mid">Encoded Slots</h2>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && void loadSlots()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search lot, block, holder..." />
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="OCCUPIED">Occupied</option>
            </select>
            <button onClick={() => void loadSlots()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Search</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {slots.map(slot => (
            <article key={slot.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-mid">{slot.slotCode}</p>
                  <p className="text-xs text-slate-500">{slot.section || 'No section'} · Block {slot.block || '—'} · Lot {slot.lotNumber}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(slot.status)}`}>{slot.status}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="text-right text-navy-mid">{slot.lotType.split('_').join(' ')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Rights holder</dt><dd className="text-right text-navy-mid">{slot.rightsHolderName || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Burials</dt><dd className="text-right text-navy-mid">{slot.burialCount}</dd></div>
              </dl>
              {slot.burials.length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{slot.burials.map(b => b.deceasedName).join(', ')}</div>}
            </article>
          ))}
          {slots.length === 0 && <p className="text-sm text-slate-500">No cemetery slots encoded yet.</p>}
        </div>
      </section>
    </div>
  )
}
