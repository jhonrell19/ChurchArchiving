'use client'

import {useCallback,useEffect,useState} from 'react'
import ParishCalendar from '../../components/ParishCalendar'
import type {Service} from '@/lib/siteContent'

type Media={id:string;type:'image'|'video';url:string;displaySeconds:number}
type Notice={id:number;title:string;body:string;category:string|null;date:string|null;starts:string|null;ends:string|null;media:Media[]}
export default function AnnouncementsPage({services}:{services:Service[]}){
  const [notices,setNotices]=useState<Notice[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const [now,setNow]=useState('')
  useEffect(()=>{
    const update=()=>setNow(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
    update();const t=window.setInterval(update,60000);return ()=>window.clearInterval(t)
  },[])
  const active=notices.filter(n=>!now||((!n.starts||n.starts<=now)&&(!n.ends||n.ends>=now)))
  const load=useCallback(async()=>{
    setLoading(true);setError(false)
    try{
      const response=await fetch('/api/public-notices',{cache:'no-store'})
      if(!response.ok)throw Error()
      const result=await response.json()
      setNotices(Array.isArray(result.notices)?result.notices:[])
    }catch{setError(true)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  return <div className="max-w-6xl space-y-6 text-slate-900">
    <div className="role-banner">
      <p className="portal-eyebrow">Parish community</p>
      <h2>Mass schedules and announcements</h2>
      <p>View upcoming services and official notices from the parish. Expired notices are removed automatically.</p>
    </div>
    <ParishCalendar services={services} notices={active.map(n=>({
      id:n.id,title:n.title,body:n.body,date:n.date,starts:n.starts,ends:n.ends,
    }))}/>
    {error?<section className="role-card">
      <p role="alert">The parish notices could not be loaded right now.</p>
      <button className="portal-secondary-btn mt-3" onClick={()=>void load()}>Try again</button>
    </section>:loading?<p role="status">Loading parish announcements…</p>
      :active.length===0?<section className="role-card"><h3 className="text-xl font-bold">No public notices at the moment</h3><p className="mt-2 text-slate-600">The parish office will publish new announcements here.</p></section>
      :<section aria-labelledby="notices-heading">
        <h3 id="notices-heading" className="role-subtitle mb-3">Current parish notices</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {active.map(n=><article key={n.id} className="role-card space-y-3">
            <div><p className="portal-eyebrow">{n.category||'General'}</p>
              <h4 className="text-xl font-bold">{n.title}</h4></div>
            {n.media.length>0&&<div className="grid gap-2">
              {n.media.slice(0,5).map(m=>m.type==='video'
                ?<video key={m.id} src={m.url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-slate-200 object-cover" aria-label={'Announcement video for '+n.title}/>
                :<img key={m.id} src={m.url} alt={'Illustration for '+n.title} loading="lazy" className="aspect-video w-full rounded-xl object-cover"/>)}
            </div>}
            <p className="whitespace-pre-line text-base text-slate-700">{n.body}</p>
            <p className="text-sm text-slate-600">
              {n.date?'Event date: '+n.date+' · ':''}Published through {n.ends||'parish announcement period'}
            </p>
          </article>)}
        </div>
      </section>}
  </div>
}
