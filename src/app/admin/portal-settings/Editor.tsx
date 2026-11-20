'use client'
import {useEffect,useState} from 'react'
export default function Editor(){
  const [policy,setPolicy]=useState(''),[catalog,setCatalog]=useState<Record<string,string[]>>({}),[category,setCategory]=useState('baptismal')
  const [message,setMessage]=useState('Loading…'),[choices,setChoices]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{fetch('/api/portal-config').then(r=>r.json()).then(d=>{setCatalog(d.purposes);setPolicy(d.policy?.body||'');setMessage('')}).catch(()=>setMessage('Unable to load settings.'))},[])
  useEffect(()=>setChoices((catalog[category]||[]).join('\n')),[catalog,category])
  async function save(body:object){
    setBusy(true)
    try{const r=await fetch('/api/portal-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!r.ok)throw Error('Check your entries and try again.')
      if('choices' in body)setCatalog({...catalog,[category]:choices.split('\n').filter(Boolean)})
      setMessage('Changes published.')
    }catch(e){setMessage(e instanceof Error?e.message:'Save failed.')}finally{setBusy(false)}
  }
  return <><p role="status">{message}</p><form className="parish-filters" onSubmit={e=>{e.preventDefault();void save({policy})}}>
    <label>Privacy notice<textarea required minLength={20} maxLength={20000} rows={8} value={policy} onChange={e=>setPolicy(e.target.value)}/></label>
    <button disabled={busy}>Publish new version</button></form>
    <form className="parish-filters" onSubmit={e=>{e.preventDefault();void save({category,choices:choices.split('\n').map(v=>v.trim()).filter(Boolean)})}}>
    <label>Certificate<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.keys(catalog).map(k=><option key={k}>{k}</option>)}</select></label>
    <label>Request purposes, one per line<textarea required rows={7} value={choices} onChange={e=>setChoices(e.target.value)}/></label>
    <button disabled={busy}>Save purposes</button></form></>
}
