'use client'
import OfficeHeading from '@/components/OfficeHeading'
import { useEffect, useState } from 'react'

import { ReportChart } from './ReportChart'
import SupervisorReports from './SupervisorReports'

type Row = { month: string, type: string, status: string, requests: number, collected: number }
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function ReportView({ officeHome, burial, supervisor }: { officeHome: string; burial: boolean, supervisor:boolean }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState('Loading report…')
  const [refresh, setRefresh] = useState(0)
  const endpoint = '/api/backend/api/reports/certificates?' + query
  useEffect(() => {
    const controller = new AbortController()
    setState('Loading report…')
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw Error(data.error || 'Report unavailable.')
      if (!controller.signal.aborted) { setRows(data.rows); setState('') }
    }).catch(e => { if (!controller.signal.aborted) setState(e.message) })
    return () => controller.abort()
  }, [endpoint, refresh])
  const types = burial ? ['burial', 'land_agreement', 'ownership'] : ['baptismal', 'confirmation', 'marriage']
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const byPayment = new URLSearchParams(query).get('basis') === 'paid'
  const chartTitle = byPayment ? 'Collections by certificate (PHP)' : 'Requests by certificate'
  const categories = new Map<string, number>()
  for (const row of rows) categories.set(row.type, (categories.get(row.type) || 0) + (byPayment ? row.collected : row.requests))
  return <main className="office-page parish-workspace">
    <OfficeHeading title="Certificate activity" home={officeHome}/>
    <p>Choose the request date or the recorded payment date. Payment totals include cash and verified live PayMongo payments. Entries without a payment date are excluded from the payment-date view.</p>
    <form className="parish-filters" onSubmit={e => {
      e.preventDefault()
      const params = new URLSearchParams()
      for (const [key, value] of new FormData(e.currentTarget)) if (value) params.set(key, String(value))
      setQuery(params.toString()); setRefresh(n => n + 1)
    }}>
      <label>Group by<select name="basis"><option value="created">Request date</option><option value="paid">Payment date</option></select></label>
      <label>From<input required name="from" type="date" defaultValue={today.slice(0, 8) + '01'} /></label>
      <label>Through<input required name="to" type="date" defaultValue={today} /></label>
      <label>Certificate<select name="type"><option value="">All types</option>{types.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Status<select name="status"><option value="">All statuses</option>{['Pending','Approved','Rejected','Ready','Released'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Payment<select name="method"><option value="">All methods</option><option value="CASH">Cash</option><option value="PAYMONGO_LIVE">QR Ph · live</option><option value="PAYMONGO_TEST">QR Ph · test</option></select></label>
      <button>Apply filters</button>
    </form>
    {state ? <p role="status">{state}</p> : <>
      <section className="parish-metrics"><div>Requests<strong>{rows.reduce((v,r) => v+r.requests,0)}</strong></div><div>Collected<strong>{money.format(rows.reduce((v,r) => v+r.collected,0))}</strong></div></section>
      {rows.length ? <>
        <ReportChart title={chartTitle} currency={byPayment} values={Array.from(categories,([label,value])=>({label,value}))}/>
        <h2>Breakdown</h2>
        <p><a href={endpoint+'&format=pdf'}>Download PDF</a> · <a href={endpoint+'&format=xlsx'}>Download Excel</a></p>
        <div className="overflow-x-auto"><table><thead><tr>{['Month','Certificate','Status','Requests','Collected'].map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={[r.month,r.type,r.status].join('|')}><td>{r.month}</td><td>{r.type}</td><td>{r.status}</td><td>{r.requests}</td><td>{money.format(r.collected)}</td></tr>)}</tbody></table></div>
      </> : <p>No requests match these filters.</p>}
    </>}
    {supervisor && <SupervisorReports/>}
  </main>
}
