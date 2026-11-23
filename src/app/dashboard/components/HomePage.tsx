'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Page } from '../types'
import MassMediaPlayer from '../../components/MassMediaPlayer'
import TrackingDashboardCard from './TrackingDashboardCard'
import StatusNotificationInbox from './StatusNotificationInbox'

type Mass = {id:number;title:string;priest:string;filepath:string|null}
type Notice = {id:number;title:string;body:string;date:string}
type Summary = {
  recentMasses:Mass[]; announcements:Notice[]
}

export default function HomePage({setPage}:{setPage:(p:Page)=>void}) {
  const [data,setData]=useState<Summary|null>(null)
  const [loading,setLoading]=useState(true)
  const [unavailable,setUnavailable]=useState(false)
  const [playing,setPlaying]=useState<{title:string;filepath:string}|null>(null)
  const load=useCallback(async()=>{
    setLoading(true);setUnavailable(false)
    try {
      const response=await fetch('/api/backend/api/user/dashboard-summary',{cache:'no-store'})
      if (!response.ok)throw Error()
      const result:Summary=await response.json()
      setData(result)
    } catch {setUnavailable(true);setData(null)}
    finally {setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  const mass=data?.recentMasses?.[0]
  const notice=data?.announcements?.[0]
  return <div className="space-y-6">
    <section className="role-banner">
      <p className="portal-eyebrow">Your parish portal</p>
      <h2>Welcome to Smart Parish</h2>
      <p>Request a church certificate, check your request status, or read the latest parish updates. Choose what you need below.</p>
    </section>
    <section aria-label="Common parish actions">
      <h3 className="role-subtitle mb-3">What would you like to do?</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" className="role-action" onClick={()=>setPage('requests')}>
          <span>Request a certificate <small className="block text-sm font-normal text-slate-600">Baptismal, marriage, confirmation and more</small></span>
          <i className="ti ti-file-plus" aria-hidden="true"/>
        </button>
        <button type="button" className="role-action" onClick={()=>setPage('announcements')}>
          <span>Mass schedule and notices</span><i className="ti ti-calendar" aria-hidden="true"/>
        </button>
        <button type="button" className="role-action" onClick={()=>setPage('archives')}>
          <span>Watch recorded Mass</span><i className="ti ti-video" aria-hidden="true"/>
        </button>
      </div>
    </section>
    <TrackingDashboardCard onOpen={()=>setPage('requests')}/>
    <details className="role-detail">
      <summary>My parish notifications</summary>
      <StatusNotificationInbox/>
    </details>
    <section>
      <h3 className="role-subtitle mb-3">Latest parish updates</h3>
      {unavailable && <div role="status" className="role-card flex flex-wrap gap-3 items-center justify-between">
        <p>Latest updates are temporarily unavailable. Your account and requests are unaffected.</p>
        <button type="button" className="portal-secondary-btn" onClick={()=>void load()}>Try again</button>
      </div>}
      <div className="grid gap-4 md:grid-cols-2">
        <article className="role-card">
          <p className="portal-eyebrow">Announcement</p>
          <h4 className="text-xl font-bold">{notice?.title||'Parish announcements'}</h4>
          <p className="my-3 text-slate-600">{notice?.body?.slice(0,240) || (loading?'Loading…':'See the calendar for the latest Mass schedules and announcements.')}</p>
          <button className="portal-secondary-btn" onClick={()=>setPage('announcements')}>View notices and calendar</button>
        </article>
        <article className="role-card">
          <p className="portal-eyebrow">Latest Mass</p>
          <h4 className="text-xl font-bold">{mass?.title||'Recorded Masses'}</h4>
          <p className="my-3 text-slate-600">{mass?.priest|| (loading?'Loading…':'Watch published Mass recordings and read available homily transcripts.')}</p>
          {mass?.filepath ? <button className="portal-secondary-btn" onClick={()=>setPlaying({title:mass.title,filepath:mass.filepath!})}>Play recording</button>
            : <button className="portal-secondary-btn" onClick={()=>setPage('archives')}>Browse Mass recordings</button>}
        </article>
      </div>
    </section>
    {playing && <MassMediaPlayer title={playing.title} filepath={playing.filepath} onClose={()=>setPlaying(null)}/>}
  </div>
}
