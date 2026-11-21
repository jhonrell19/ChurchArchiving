'use client'

import { useEffect, useState } from 'react'

import { SCHEDULE } from './serviceSchedule'

type Notice = {id:number; title:string; body:string; date?:string; starts?:string; ends?:string}
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const manilaDate = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

const key = (d:Date) => d.toISOString().slice(0,10)
const dateOf = (s:string) => new Date(s + 'T12:00:00Z')
const label = (d:Date, options:Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-PH',{...options,timeZone:'UTC'})
const full = (s:string) => label(dateOf(s),{month:'long',day:'numeric',year:'numeric'})
const applies = (n:Notice, day:string) => n.date === day || (!!n.starts && !!n.ends && n.starts <= day && day <= n.ends)
function noticeEnd(end:string,today:string) {
  const days = Math.round((dateOf(end).getTime()-dateOf(today).getTime()) / 86400000)
  if (days===0) return 'Notice ends today'
  if (days===1) return 'Notice ends tomorrow · '+full(end)
  if (days>1 && days<=3) return 'Notice ends in '+days+' days · '+full(end)
  return 'Notice ends '+full(end)
}

export default function ParishCalendar({notices:provided,services:schedule=SCHEDULE}:{notices?:Notice[],services?:typeof SCHEDULE}) {
  const weekly=dayNames.map(day=>schedule.filter(s=>s.day.startsWith(day)).map(s=>s.time+' · '+s.tag))
  const [today,setToday] = useState('')
  const [selected,setSelected] = useState('')
  const [remote,setRemote] = useState<Notice[]>([])
  const [status,setStatus] = useState('Loading parish notices…')
  const [retry,setRetry] = useState(0)
  useEffect(()=>{
    const update = () => {const day=manilaDate();setToday(day);setSelected(prev=>prev || day)}
    update()
    const timer=setInterval(update,60000)
    return ()=>clearInterval(timer)
  },[])
  useEffect(()=>{
    if(provided) return
    const controller=new AbortController()
    async function load(){
      try{
        const res=await fetch('/api/parish-calendar',{signal:controller.signal,cache:'no-store'})
        if(!res.ok) throw Error()
        const data=await res.json()
        setRemote(data.notices);setStatus('')
      }catch{if(!controller.signal.aborted)setStatus('Parish notices could not be loaded.')}
    }
    void load()
    return ()=>controller.abort()
  },[provided,retry,today])
  if(!selected) return <section className="calendar-section"><h2>Parish calendar</h2><p>Loading the calendar…</p></section>
  const items=provided || remote
  const day=dateOf(selected), y=day.getUTCFullYear(), m=day.getUTCMonth()
  const first=new Date(Date.UTC(y,m,1)), days=new Date(Date.UTC(y,m+1,0)).getUTCDate()
  const services=weekly[day.getUTCDay()] || []
  const notices=items.filter(n=>applies(n,selected))
  const month=label(day,{month:'long',year:'numeric'})
  return <section className="calendar-section" aria-label="Parish calendar">
    <h2>Parish calendar</h2>
    <p>Choose a date to see services and notices. All times are Philippine time.</p>
    <div className="calendar-layout">
      <div className="month-card">
        <div className="month-nav"><button aria-label="Previous month" onClick={()=>setSelected(key(new Date(Date.UTC(y,m-1,1))))}>‹</button><h3 aria-live="polite">{month}</h3><button aria-label="Next month" onClick={()=>setSelected(key(new Date(Date.UTC(y,m+1,1))))}>›</button></div>
        <div className="month-grid">
          {dayNames.map(n=><span className="weekday" key={n}>{n}</span>)}
          {Array.from({length:first.getUTCDay()},(_,i)=><span key={'blank'+i}/>)}
          {Array.from({length:days},(_,i)=>{
            const d=new Date(Date.UTC(y,m,i+1)), iso=key(d)
            const marked=weekly[d.getUTCDay()].length > 0 || items.some(n=>applies(n,iso))
            return <button key={iso} aria-label={full(iso)+(marked?', service or notice':'')} aria-pressed={selected===iso} aria-current={today===iso?'date':undefined} onClick={()=>setSelected(iso)}>{i+1}{marked&&<span aria-hidden="true">●</span>}</button>
          })}
        </div>
        <div className="calendar-key"><span>● Service or notice</span><button onClick={()=>setSelected(today)}>Back to today</button></div>
      </div>
      <div className="day-card" aria-live="polite">
        <p className="place">{label(day,{weekday:'long'})}</p><h3>{full(selected)}</h3>
        {services.map((s,i)=><p className="service-row" key={i}>{s}</p>)}
        {notices.map(n=><article key={n.id}><h4>{n.title}</h4>
          {n.date && /^\d{4}-\d{2}-\d{2}$/.test(n.date) && <p>Event date · {full(n.date)}</p>}
          <p>{n.body}</p>
          {n.starts && <p>Notice starts {full(n.starts)}</p>}
          {n.ends && <strong>{noticeEnd(n.ends,today)}</strong>}
        </article>)}
        {!services.length&&!notices.length&&<p>No services or notices listed for this date.</p>}
        {!provided && status && <p role="status">{status} {status.includes('could not') && <button onClick={()=>setRetry(v=>v+1)}>Try again</button>}</p>}
      </div>
    </div>
  </section>
}
