'use client'
import { useCallback, useEffect, useState } from 'react'

type ArchiveStats = { totalRecords: number; baptismal: number; confirmation: number; marriage: number; burial: number; landAgreement: number }
type Request = {id: number; requesterName: string; sacramentType: string; status: string; personName?:string}
type Summary = { requests: Request[]; counts?: Record<string,number> }

export default function StaffHome({ openArchives, openRequests, openDeceased }:{
  openArchives:()=>void;openRequests:()=>void;openDeceased:()=>void
}) {
  const [stats,setStats]=useState<ArchiveStats|null>(null)
  const [requests,setRequests]=useState<Request[]>([])
  const [counts,setCounts]=useState<Record<string,number>>({})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const refresh=useCallback(async()=>{
    setLoading(true);setError(false)
    const results=await Promise.allSettled([
      fetch('/api/backend/api/archive/stats',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<ArchiveStats>}),
      fetch('/api/backend/api/requests?page=1',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Summary>}),
    ])
    setStats(results[0].status==='fulfilled'?results[0].value:null)
    setRequests(results[1].status==='fulfilled'&&Array.isArray(results[1].value.requests)?results[1].value.requests:[])
    setCounts(results[1].status==='fulfilled'?results[1].value.counts||{}:{})
    setError(results.some(result=>result.status==='rejected'))
    setLoading(false)
  },[])
  useEffect(()=>{void refresh()},[refresh])
  return <div className="space-y-6">
    <section className="role-banner">
      <p className="portal-eyebrow">Documents and certificates</p>
      <h2>Church Staff workspace</h2>
      <p>One place for baptismal, confirmation, marriage, burial history, land agreements, and ownership documents. The parish office processes requests here.</p>
    </section>
    {error && <div className="role-card flex flex-wrap items-center justify-between gap-3" role="status">
      <span>Some live figures could not be loaded.</span>
      <button type="button" onClick={()=>void refresh()} className="portal-secondary-btn">Retry</button>
    </div>}
    <section aria-label="Document office summary">
      <h3 className="role-subtitle mb-3">Today's work</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ['Total archive records',stats?.totalRecords],
          ['Pending requests',counts.Pending],
          ['Approved requests',counts.Approved],
          ['Ready for release',counts.Ready],
        ] as const).map(([label,value])=><article className="role-card role-metric" key={label}>
          <strong>{value ?? (loading?'…':'—')}</strong><p>{label}</p>
        </article>)}
      </div>
    </section>
    <section>
      <h3 className="role-subtitle mb-3">What would you like to do?</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" onClick={openArchives} className="role-action"><span>Find or archive a document</span><i className="ti ti-archive"/></button>
        <button type="button" onClick={openRequests} className="role-action"><span>Process a certificate request</span><i className="ti ti-file-certificate"/></button>
        <button type="button" onClick={openDeceased} className="role-action"><span>View deceased records</span><i className="ti ti-file-text"/></button>
      </div>
    </section>
    <section className="role-card">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h3 className="role-subtitle">Latest certificate requests</h3>
        <button type="button" className="portal-secondary-btn" onClick={openRequests}>Open all requests</button>
      </div>
      {requests.length?<div className="divide-y divide-slate-200">
        {requests.slice(0,5).map(item=><div key={item.id} className="flex flex-wrap gap-3 justify-between py-3">
          <div><p className="font-semibold">Request #{item.id} · {item.sacramentType.replaceAll('_',' ')}</p>
            <p className="text-slate-600">{item.personName||item.requesterName}</p></div>
          <strong className="text-slate-700">{item.status}</strong>
        </div>)}
      </div>:<p className="text-slate-600">{loading?'Loading requests…':'No requests found.'}</p>}
      <p className="mt-3 text-sm text-slate-600">Verify the archive record before approving. Release documents only after valid payment confirmation and review.</p>
    </section>
  </div>
}
