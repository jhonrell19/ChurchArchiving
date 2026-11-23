'use client'
import { useCallback, useEffect, useState } from 'react'

type ArchiveStats = {
  totalRecords: number; baptismal: number; confirmation: number;
  marriage: number; burial: number; landAgreement: number;
}
type Request = { id: number; status: string; sacramentType: string; requesterName: string; createdAt?: string }
type RequestList = { requests: Request[]; counts?: Record<string, number> }
type MonthPoint = {month:string;total:number}
type Overview = {
  parishioners:number;staff:number;disabledStaff:number;newUploads:number|null;
  requestsByMonth:MonthPoint[];burialsByMonth:MonthPoint[];burialsAvailable:boolean
}
type Audit = { id: number; action: string; user: string }

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return response.json() as Promise<T>
}
function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="role-card role-metric"><strong>{value}</strong><p>{label}</p>{note && <small className="text-slate-600">{note}</small>}</div>
}
function MonthlyChart({title,points,loading,available=true,note}:{
  title:string;points?:MonthPoint[];loading:boolean;available?:boolean;note:string
}) {
  const max=Math.max(1,...(points??[]).map(x=>x.total))
  return <div className="role-card">
    <h4 className="text-lg font-bold mb-1">{title}</h4>
    <p className="text-sm text-slate-600 mb-4">{note}</p>
    {!available?<p className="text-slate-600">Burial reporting is not available on this deployment.</p>
      :loading?<p>Loading activity…</p>
      :!points?.length?<p className="text-slate-600">No entries in this period.</p>
      :<div className="space-y-2">{points.map(x=><div key={x.month}>
        <div className="flex justify-between text-sm font-semibold"><span>{x.month}</span><span>{x.total}</span></div>
        <div className="mt-1 h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{width:`${100*x.total/max}%`,backgroundColor:'var(--portal-accent)'}}/>
        </div>
      </div>)}</div>}
  </div>
}

export default function SuperAdminOverview({
  manageStaff, manageWebsite, onOpenMasses, onOpenNotices, onOpenSettings,
}: {
  manageStaff: boolean; manageWebsite: boolean; onOpenMasses: () => void;
  onOpenNotices: () => void; onOpenSettings: () => void;
}) {
  const [overview,setOverview] = useState<Overview|null>(null)
  const [archives,setArchives] = useState<ArchiveStats|null>(null)
  const [requests,setRequests] = useState<RequestList|null>(null)
  const [audit,setAudit] = useState<Audit[]>([])
  const [error,setError] = useState(false)
  const [loading,setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true);setError(false)
    const results = await Promise.allSettled([
      read<Overview>('/api/admin/overview'),
      read<ArchiveStats>('/api/backend/api/archive/stats'),
      read<RequestList>('/api/backend/api/requests?page=1'),
      read<{logs:Audit[]}>('/api/backend/api/archive/audit-logs'),
    ])
    const [users,records,reqs,auditList] = results
    setOverview(users.status==='fulfilled'?users.value:null)
    setArchives(records.status==='fulfilled'?records.value:null)
    setRequests(reqs.status==='fulfilled'?reqs.value:null)
    setAudit(auditList.status==='fulfilled'&&Array.isArray(auditList.value.logs)?auditList.value.logs:[])
    setError(results.some(x=>x.status==='rejected'))
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])
  const categoryCounts = archives ? [
    ['Baptism',archives.baptismal],['Confirmation',archives.confirmation],
    ['Marriage',archives.marriage],['Burial',archives.burial],['Land agreements',archives.landAgreement],
    ['Other archives incl. ownership',Math.max(0,archives.totalRecords-archives.baptismal-archives.confirmation-archives.marriage-archives.burial-archives.landAgreement)],
  ] as const : []
  const maxCategory=Math.max(1,...categoryCounts.map(([,n])=>n))
  const pending=requests?.counts?.Pending

  return <section className="space-y-6">
    <div className="role-banner">
      <p className="portal-eyebrow">Parish operations</p>
      <h2>Super Admin overview</h2>
      <p>Review parish activity, manage people and policies, and oversee Mass media. Church Staff handles document processing.</p>
    </div>
    {error && <div className="role-card flex flex-wrap justify-between gap-3 items-center" role="status">
      <p>Some live statistics could not be loaded. Existing records were not changed.</p>
      <button onClick={()=>void load()} className="portal-secondary-btn">Retry overview</button>
    </div>}
    <section aria-label="Parish summary">
      <h3 className="role-subtitle mb-3">At a glance</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Archived records" value={archives?.totalRecords ?? (loading?'…':'—')}/>
        <Tile label="Pending certificate requests" value={pending ?? (loading?'…':'—')} note="Across all document categories"/>
        <Tile label="Registered parishioners" value={overview?.parishioners ?? (loading?'…':'—')}/>
        <Tile label="New document uploads this month" value={overview?.newUploads ?? (loading?'…':'—')} note="Active archive documents added this month"/>
      </div>
    </section>
    <section>
      <h3 className="role-subtitle mb-3">Quick actions</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {manageStaff && <a href="/admin/staff" className="role-action"><span>Manage Church Staff <small className="block text-sm font-normal text-slate-600">{overview?.staff ?? '—'} staff accounts</small></span><i className="ti ti-users"/></a>}
        <a href="/admin/member-approvals" className="role-action"><span>Review membership</span><i className="ti ti-user-check"/></a>
        <button onClick={onOpenMasses} className="role-action"><span>Manage Mass recordings</span><i className="ti ti-video"/></button>
        <button onClick={onOpenNotices} className="role-action"><span>Post announcements</span><i className="ti ti-bell"/></button>
        <a href="/office-reports" className="role-action"><span>Reports and exports</span><i className="ti ti-chart-bar"/></a>
        {manageWebsite && <a href="/admin/site-content" className="role-action"><span>Edit public website</span><i className="ti ti-world"/></a>}
        <button onClick={onOpenSettings} className="role-action"><span>Parish settings and fees</span><i className="ti ti-settings"/></button>
      </div>
    </section>
    <section>
      <h3 className="role-subtitle mb-3">Monthly activity</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <MonthlyChart title="Certificate requests by month" points={overview?.requestsByMonth} loading={loading} note="Requests submitted in the last six months"/>
        <MonthlyChart title="Burial records added by month" points={overview?.burialsByMonth} loading={loading}
          available={overview?.burialsAvailable} note="Records entered, not necessarily burial service dates"/>
      </div>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="role-card">
        <h3 className="role-subtitle mb-3">Records by category</h3>
        {archives ? <div className="space-y-3">{categoryCounts.map(([name,count])=><div key={name}>
          <div className="flex justify-between text-base font-medium"><span>{name}</span><span>{count}</span></div>
          <div className="mt-1 h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{width:`${100*count/maxCategory}%`,backgroundColor:'var(--portal-accent)'}}/></div>
        </div>)}</div> : <p className="text-slate-600">{loading?'Loading…':'Record totals unavailable.'}</p>}
        <p className="mt-3 text-sm text-slate-600">Document processing is assigned to Church Staff. Additional detailed reports are available through Reports and exports.</p>
      </section>
      <section className="role-card">
        <h3 className="role-subtitle mb-3">Recent audit activity</h3>
        {audit.length?<ul className="space-y-3">{audit.slice(0,5).map(item=><li className="border-b pb-2 last:border-0" key={item.id}>
          <p className="font-semibold">{item.action}</p><small className="text-slate-600">{item.user}</small>
        </li>)}</ul>:<p className="text-slate-600">{loading?'Loading activity…':'No recent activity to display.'}</p>}
      </section>
    </div>
  </section>
}
