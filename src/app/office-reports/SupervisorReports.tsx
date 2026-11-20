'use client'
import {useState,useEffect} from 'react'
import { ReportChart } from './ReportChart'
type Metric={label:string,value:number,capacity?:number}
type Schedule={id:number,frequency:string,format:string,office:string,enabled:boolean,next_run:string,latest:string|null}
const titles:Record<string,string>={membership:'Approved members by activity status',registrations:'Registrations by month · last year',cemetery:'Cemetery plots by status',staff:'Staff audit events · last 30 days',appointments:'Upcoming appointment bookings and capacity',storage:'Tracked private upload bytes'}
const base='/api/backend/api/reports/'
export default function SupervisorReports(){
  const [metrics,setMetrics]=useState<Record<string,Metric[]>>({}),[schedules,setSchedules]=useState<Schedule[]>([])
  const [actor,setActor]=useState(''),[revision,refresh]=useState(0),[message,setMessage]=useState('Loading…'),[busy,setBusy]=useState(false)
  useEffect(()=>{const ctl=new AbortController()
    async function load(path:string){const r=await fetch(base+path,{signal:ctl.signal,cache:'no-store'});const d=await r.json()
      if(!r.ok)throw Error(d.error||'Unable to load reporting data.');return d}
    Promise.all([load('members?actor='+encodeURIComponent(actor)),load('schedules')]).then(([m,s])=>{
      if(!ctl.signal.aborted){setMetrics(m);setSchedules(s.items);setMessage('')}
    }).catch(e=>{if(!ctl.signal.aborted)setMessage(e.message)})
    return ()=>ctl.abort()
  },[actor,revision])
  async function save(path:string,body:object){setBusy(true)
    try{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const d=await r.json();if(!r.ok)throw Error(d.error||'Save failed.');refresh(n=>n+1)
    }catch(e){setMessage(e instanceof Error?e.message:'Request interrupted.')}finally{setBusy(false)}}
  return <section><h2>Parish-wide reports</h2><p role="status">{message}</p>
    <form className="parish-filters" onSubmit={e=>{e.preventDefault();setActor(String(new FormData(e.currentTarget).get('actor')||''))}}>
      <label>Staff email for activity filter<input name="actor" type="email"/></label><button>Apply</button></form>
    <div className="grid gap-4 md:grid-cols-2">{Object.entries(metrics).map(([key,rows])=><article key={key} className="border rounded-xl bg-white p-4">
      <h2>{titles[key]}</h2>{rows.length>0 && <ReportChart title={titles[key]} values={rows.map(r=>({label:r.label,value:Number(r.value)}))}/>}
      {rows.length?rows.map(row=><p key={row.label}>{row.label} · <strong>{Number(row.value).toLocaleString()}</strong>{row.capacity!==undefined?' / '+row.capacity:''}</p>):<p>No recorded data.</p>}</article>)}</div>
    <h2>Member activity review</h2><form className="parish-filters" onSubmit={e=>{e.preventDefault();void save('members',Object.fromEntries(new FormData(e.currentTarget)))}}>
      <label>Approved member email<input required type="email" name="email"/></label>
      <label>Status<select name="status"><option>active</option><option>inactive</option></select></label>
      <label>Review reason<input required minLength={5} maxLength={500} name="reason"/></label><button disabled={busy}>Record review</button></form>
    <h2>Scheduled certificate reports</h2><form className="parish-filters" onSubmit={e=>{e.preventDefault();void save('schedules',Object.fromEntries(new FormData(e.currentTarget)))}}>
      <label>Office<select name="office"><option value="main">Parish</option><option value="burial">Burial</option></select></label>
      <label>Frequency<select name="frequency"><option>weekly</option><option>monthly</option></select></label>
      <label>Format<select name="format"><option>pdf</option><option>xlsx</option></select></label>
      <label>Certificate<select name="type"><option value="">All in office</option>{['baptismal','confirmation','marriage','ownership','land_agreement','burial'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Status<select name="status"><option value="">All</option>{['Pending','Approved','Ready','Released','Rejected'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Payment<select name="method"><option value="">All</option><option>CASH</option><option>PAYMONGO_LIVE</option><option>PAYMONGO_TEST</option></select></label>
      <button disabled={busy}>Create schedule</button></form>
    {schedules.map(s=><p key={s.id}>{s.office} · {s.frequency} · {s.format.toUpperCase()} · {s.enabled?'Next '+s.next_run:'Disabled'}{' '}
      {s.latest && <a href={base+'schedules/'+s.id+'/latest'}>Download last report</a>}{' '}
      {s.enabled && <button disabled={busy} onClick={()=>void save('schedules',{action:'disable',id:s.id})}>Disable</button>}</p>)}</section>
}
