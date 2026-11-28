'use client'
import {useEffect,useState} from 'react'
import { sanitizePersonName } from '@/lib/fieldInput'
type Item={id:number,owner_name:string,category:string,relationship:string,status:string,reason:string|null}
const base='/api/backend/api/claims'
export default function ClaimDesk({applicant}:{applicant:boolean}) {
  const [page,setPage]=useState(1),[revision,reload]=useState(0),[rows,setRows]=useState<Item[]>([])
  const [next,setNext]=useState(false),[supervisor,setSupervisor]=useState(false),[busy,setBusy]=useState(false)
  const [notice,setNotice]=useState(''),[state,setState]=useState('Loading claims…')
  useEffect(()=>{
    const ctl=new AbortController()
    setState('Loading claims…')
    fetch(base+'?page='+page,{signal:ctl.signal,cache:'no-store'}).then(async r=>{
      const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load claims.')
      if(!ctl.signal.aborted){setRows(d.items);setNext(d.hasNext);setSupervisor(d.supervisor);setState('')}
    }).catch(e=>{if(!ctl.signal.aborted)setState(e.message)})
    return ()=>ctl.abort()
  },[page,revision])
  async function submit(url:string, options:RequestInit){
    setBusy(true);setNotice('')
    try{const r=await fetch(url,options);const d=await r.json()
      if(!r.ok)throw Error(d.error||'Unable to save.')
      setNotice(d.id?'Claim #'+d.id+' submitted.':'Review recorded.');reload(n=>n+1)
    }catch(e){setNotice(e instanceof Error?e.message:'Request interrupted.')}finally{setBusy(false)}
  }
  return <>{applicant && <><p>Request permission to obtain a relative’s record. Staff compare your supporting document with the parish archive.</p>
    <form className="parish-filters" onSubmit={e=>{e.preventDefault();void submit(base,{method:'POST',body:new FormData(e.currentTarget)})}}>
      <label>Name on record<input required name="name" minLength={2} maxLength={150} onInput={e => { e.currentTarget.value = sanitizePersonName(e.currentTarget.value) }}/></label>
      <label>Certificate<select name="category">{['baptismal','confirmation','marriage','ownership'].map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Relationship<input required name="relationship" maxLength={80}/></label>
      <label>Proof of relationship or authorization (JPEG/PNG)<input required type="file" name="proof" accept="image/png,image/jpeg"/></label>
      <button disabled={busy}>Submit claim</button>
    </form></>}
    <p role="status">{notice}</p>{state?<p role="status">{state}</p>:<>
    {!rows.length && <p>No claims on this page.</p>}
    {rows.map(row=><article key={row.id} className="rounded-xl bg-white border p-5 my-3">
      <h2>#{row.id} · {row.owner_name}</h2><p>{row.category} · {row.relationship} · <strong>{row.status}</strong></p>
      {row.reason && <p>Review reason: {row.reason}</p>}
      {!applicant && (row.status==='pending'||(row.status==='disputed'&&supervisor)) && <>
        <a href={base+'/'+row.id+'/proof'} target="_blank" rel="noreferrer">Review private proof</a>
        <form className="parish-filters" onSubmit={e=>{e.preventDefault()
          const fields=new FormData(e.currentTarget)
          void submit(base+'/'+row.id+'/review',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({decision:fields.get('decision'),reason:fields.get('reason'),certificate:fields.get('certificate'),checked:fields.has('checked')})})
        }}><label>Decision<select name="decision"><option value="approved">Approve</option><option value="rejected">Reject</option>
          {row.status==='pending' && <option value="disputed">Escalate to Super Admin</option>}</select></label>
          <label>Matching certificate number<input name="certificate" maxLength={100}/></label>
          <label><input type="checkbox" name="checked"/>I checked the proof, owner and certificate.</label>
          <label>Review reason<input required minLength={5} maxLength={500} name="reason"/></label><button disabled={busy}>Record decision</button>
        </form></>}
    </article>)}
    <nav className="parish-pager" aria-label="Claim pages"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={!next} onClick={()=>setPage(page+1)}>Next</button></nav></>}</>
}
