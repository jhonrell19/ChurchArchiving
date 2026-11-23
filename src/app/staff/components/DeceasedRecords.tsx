'use client'
import { useCallback, useEffect, useState } from 'react'
import type { BurialRecord } from '@/app/burial-admin/types'

export default function DeceasedRecords() {
  const [records, setRecords] = useState<BurialRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async (q: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await fetch('/api/backend/api/cemetery/burials?q=' + encodeURIComponent(q), { cache: 'no-store' })
      const data = await result.json().catch(() => ({}))
      if (!result.ok || !Array.isArray(data.burials)) throw new Error(data.error || 'Burial records unavailable')
      setRecords(data.burials)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Burial records unavailable')
      setRecords([])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh('') }, [refresh])

  const fileUrl = (path: string | null) => path && path.startsWith('uploads/cemetery/')
    ? '/api/backend/api/cemetery/files/' + path : null

  return <section className="space-y-5 text-slate-900">
    <h1 className="text-2xl font-bold">Historical Deceased Records</h1>
    <p className="text-slate-600">Read-only records and supporting files from the former burial office. Cemetery slots, sales and financial operations are not part of Church Staff.</p>
    <form onSubmit={event => { event.preventDefault(); void refresh(search.trim()) }} className="flex flex-wrap gap-2">
      <label className="flex-1 text-sm font-semibold">Search deceased name or certificate number
        <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" value={search}
          onChange={event => setSearch(event.target.value)} maxLength={100} />
      </label>
      <button type="submit" className="self-end rounded-lg bg-emerald-900 px-5 py-3 text-white">Search records</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p>Loading burial records…</p> : <div className="space-y-4">
      {records.map(record => <article key={record.id} className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">{record.deceasedName}</h2>
        <p className="text-sm text-slate-600">Burial date: {record.burialDate || 'Not recorded'} · Death certificate: {record.deathCertificateNumber || 'Not recorded'}</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {([
            ['Death certificate', record.deathCertificateFile],
            ['Burial permit', record.burialPermitFile],
            ['Authorization', record.authorizationFile],
          ] as const).map(([name, path]) => fileUrl(path) &&
            <a key={name} className="text-emerald-800 underline" target="_blank" rel="noopener noreferrer" href={fileUrl(path)!}>{name}</a>)}
        </div>
      </article>)}
      {!records.length && <p>No matching deceased records found.</p>}
    </div>}
  </section>
}
