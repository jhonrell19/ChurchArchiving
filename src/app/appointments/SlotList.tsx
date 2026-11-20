'use client'
import {useEffect,useState} from 'react'
type Slot={id:number,office:string,starts_at:string,capacity:number,reserved:number,mine:boolean}
const base='/api/backend/api/appointments'
export default function SlotList({staff}:{staff:boolean}){
  const [page,setPage]=useState(1),[rev,reload]=useState(0),[slots,setSlots]=useState<Slot[]>([])
  const [next,setNext]=useState(false),[message,setMessage]=useState('Loading…'),[busy,setBusy]=useState(false)
  useEffect(()=>{const ctl=new AbortController();fetch(base+'?page='+page,{signal:ctl.signal,cache:'no-store'}).then(async r=>{
    const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load appointments.')
    if(!ctl.signal.aborted){setSlots(d.slots);setNext(d.hasNext);setMessage(d.slots.length?'':'No upcoming slots.')}
  }).catch(e=>{if(!ctl.signal.aborted)setMessage(e.message)});return ()=>ctl.abort()},[page,rev])
  async function act(body:object){
    setBusy(true)
    try{const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save booking.');reload(n=>n+1)
    }catch(e){setMessage(e instanceof Error?e.message:'Request interrupted.')}finally{setBusy(false)}
  }
  return <>{staff && <form className="parish-filters" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget)
    void act({action:'create',startsAt:String(d.get('starts'))+':00+08:00',capacity:Number(d.get('capacity'))})}}>
    <label>Start in Philippine time<input type="datetime-local" name="starts" required/></label>
    <label>Capacity<input name="capacity" type="number" min="1" max="200" defaultValue="1" required/></label>
    <button disabled={busy}>Add office slot</button></form>}
    <p role="status">{message}</p>{slots.map(s=><article key={s.id} className="border rounded-xl p-4 my-3 bg-white">
      <strong>{s.office==='main'?'Parish office':'Burial office'}</strong> · {new Date(s.starts_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} PHT
      <p>{s.reserved} of {s.capacity} booked</p>{!staff && <button disabled={busy || (!s.mine && s.reserved>=s.capacity)}
      onClick={()=>void act({action:s.mine?'cancel':'book',slotId:s.id})}>{s.mine?'Cancel my booking':'Book this slot'}</button>}</article>)}
    <nav className="parish-pager"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={!next} onClick={()=>setPage(page+1)}>Next</button></nav></>
}
