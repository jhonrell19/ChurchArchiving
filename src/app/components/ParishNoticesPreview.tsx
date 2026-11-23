'use client'

import { useEffect, useState } from 'react'
type Notice = {id:number;title:string;body:string;date?:string|null;category?:string|null}
export default function ParishNoticesPreview() {
  const [items,setItems]=useState<Notice[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/public-notices',{cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw Error();return response.json()})
      .then(data=>{if(!controller.signal.aborted)setItems(Array.isArray(data.notices)?data.notices:[])})
      .catch(()=>{if(!controller.signal.aborted)setError(true)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[])
  return <section id="parish-notices" className="portal-notices" aria-labelledby="portal-notices-heading">
    <div className="portal-section-heading">
      <div><p className="portal-eyebrow">Stay informed</p><h2 id="portal-notices-heading">Parish announcements</h2></div>
      <a href="#parish-calendar" className="portal-secondary-btn">View parish calendar</a>
    </div>
    {loading?<p role="status">Loading parish announcements…</p>
      :error?<p>Announcements could not be loaded. Check the calendar or contact the parish office.</p>
      :items.length?<div className="portal-notice-list">
        {items.slice(0,3).map(notice=><article key={notice.id}>
          <small>{notice.date||notice.category||'Parish announcement'}</small><h3>{notice.title}</h3><p>{notice.body}</p>
        </article>)}
      </div>:<p>No public announcements have been posted yet. Check the calendar for Mass schedules and events.</p>}
  </section>
}
