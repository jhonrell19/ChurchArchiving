'use client'
import {useState} from 'react'
import {weekdays,parishPhotos,type SiteContent,type Service} from '@/lib/siteContent'

function clock(time:string) {
  const [hour,minute]=time.slice(0,-3).split(':')
  return String(Number(hour)%12+(time.endsWith('PM')?12:0)).padStart(2,'0')+':'+minute
}
function display(time:string) {
  if (!time) return ''
  const [hour,minute]=time.split(':')
  return (Number(hour)%12||12)+':'+minute+(Number(hour)>=12?' PM':' AM')
}

export default function Editor({initial,initialRevision}:{initial:SiteContent;initialRevision:number}){
  const [draft,setDraft]=useState(initial),[revision,setRevision]=useState(initialRevision)
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  function updateService(index:number,change:Partial<Service>){
    setDraft(d=>({...d,services:d.services.map((s,i)=>i===index?{...s,...change}:s)}))
  }
  async function publish(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage('')
    try{
      const res=await fetch('/api/admin/site-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,content:draft})})
      const result=await res.json()
      if(!res.ok)throw Error(result.error || 'Publication failed.')
      setRevision(result.revision);setMessage('Published. Open the homepage to see your changes.')
    }catch(e){setMessage(e instanceof Error?e.message:'Publication failed.')}
    finally{setBusy(false)}
  }
  return <form onSubmit={publish}><fieldset disabled={busy}><legend>Homepage</legend>
    <label>Welcome heading<input required maxLength={90} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>Introduction<textarea required maxLength={320} value={draft.introduction} onChange={e=>setDraft({...draft,introduction:e.target.value})}/></label>
    <label>Parish photo<select value={draft.photo} onChange={e=>setDraft({...draft,photo:e.target.value})}>{parishPhotos.map((p,i)=><option key={p} value={p}>Parish photo {i+1}</option>)}</select></label>
    <img className="editor-photo" src={draft.photo} alt="Selected parish photo"/>
    </fieldset><fieldset disabled={busy}><legend>Weekly services</legend>
    <p>These times appear on the Services page and parish calendars. Removing a row takes effect when you publish.</p>
    {draft.services.map((s,i)=><div className="service-edit" key={i}>
      <label>Service name<input required maxLength={90} value={s.tag} onChange={e=>updateService(i,{tag:e.target.value})}/></label>
      <label>Day<select value={s.day} onChange={e=>updateService(i,{day:e.target.value})}>{weekdays.map(day=><option key={day}>{day}</option>)}</select></label>
      <label>Time<input required type="time" value={s.time?clock(s.time):''} onChange={e=>updateService(i,{time:display(e.target.value)})}/></label>
      <button type="button" aria-label={'Remove '+(s.tag||'service')} onClick={()=>setDraft({...draft,services:draft.services.filter((_,j)=>i!==j)})}>Remove</button>
    </div>)}
    <button type="button" disabled={draft.services.length>=60} onClick={()=>setDraft({...draft,services:[...draft.services,{day:'Sunday',time:'8:00 AM',tag:''}]})}>Add service</button></fieldset>
    <fieldset disabled={busy}><legend>Parish office contact</legend>
      <label>Address<input required maxLength={250} value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}/></label>
      <label>Office hours<input required maxLength={250} value={draft.hours} onChange={e=>setDraft({...draft,hours:e.target.value})}/></label>
      <label>Public email (optional)<input type="email" maxLength={254} value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label>
    </fieldset>
    <fieldset disabled={busy}><legend>About the parish · Our story</legend>
      {draft.story.map((paragraph,i)=><div key={i}><label>Paragraph {i+1}<textarea required maxLength={2000} value={paragraph} onChange={e=>setDraft({...draft,story:draft.story.map((v,j)=>i===j?e.target.value:v)})}/></label>
        <button type="button" onClick={()=>setDraft({...draft,story:draft.story.filter((_,j)=>i!==j)})}>Remove paragraph {i+1}</button></div>)}
      <button type="button" disabled={draft.story.length>=50} onClick={()=>setDraft({...draft,story:[...draft.story,'']})}>Add paragraph</button>
    </fieldset>
    {(['sacraments','ministries'] as const).map(group=><fieldset key={group} disabled={busy}><legend>{group==='ministries'?'Parish ministries':'Sacramental services'}</legend>
      {draft[group].map((row,i)=><div className="editor-description" key={i}>
        <label>Title<input required maxLength={100} value={row.title} onChange={e=>setDraft({...draft,[group]:draft[group].map((v,j)=>i===j?{...v,title:e.target.value}:v)})}/></label>
        <label>Description<textarea required maxLength={1500} value={row.desc} onChange={e=>setDraft({...draft,[group]:draft[group].map((v,j)=>i===j?{...v,desc:e.target.value}:v)})}/></label>
        <button type="button" onClick={()=>setDraft({...draft,[group]:draft[group].filter((_,j)=>i!==j)})}>Remove {row.title || 'entry'}</button></div>)}
      <button type="button" disabled={draft[group].length>=40} onClick={()=>setDraft({...draft,[group]:[...draft[group],{title:'',desc:''}]})}>Add {group==='ministries'?'ministry':'sacramental service'}</button></fieldset>)}
    <button disabled={busy}>{busy?'Publishing…':'Publish changes'}</button> <a href="/" target="_blank" rel="noreferrer">Open homepage</a><p role="status">{message}</p>
  </form>
}
