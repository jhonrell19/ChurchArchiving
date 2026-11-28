'use client'
import { useEffect, useState } from 'react'
import TemplateDataFields, {type TemplateRecordData} from './TemplateDataFields'

type Limits = {files:number; bytes:number; daily:number; extensions:string[]}
type Row = {file:File; name:string; fields:TemplateRecordData; reviewed:boolean; progress:number; message:string; saved:boolean}
export default function BatchArchive({category,onSaved}:{category:string;onSaved:()=>void}) {
  const [limits,setLimits]=useState<Limits|null>(null)
  const [rows,setRows]=useState<Row[]>([])
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [batch,setBatch]=useState('')
  useEffect(()=>{
    fetch('/api/backend/api/archive/batch-limits',{cache:'no-store'}).then(async r=>{
      if(!r.ok) throw Error()
      setLimits(await r.json())
    }).catch(()=>setNotice('Batch limits unavailable. Reopen the archive to retry.'))
  },[])
  function patch(index:number, values:Partial<Row>) {
    setRows(previous=>previous.map((row,i)=>i===index?{...row,...values}:row))
  }
  function upload(body:FormData,index:number) {
    return new Promise<void>((resolve,reject)=>{
      const xhr=new XMLHttpRequest()
      xhr.open('POST','/api/backend/api/archive/upload')
      xhr.upload.onprogress=e=>{if(e.lengthComputable)patch(index,{progress:Math.round(99*e.loaded/e.total)})}
      xhr.onload=()=>{
        if(xhr.status===201) return resolve()
        let message='Archive returned HTTP '+xhr.status
        try {message=JSON.parse(xhr.responseText).error || message} catch {}
        reject(new Error(message))
      }
      xhr.onerror=()=>reject(new Error('Connection lost. Check the archive before retrying.'))
      xhr.send(body)
    })
  }
  async function submit() {
    if(!limits || busy) return
    setBusy(true)
    let saved=rows.filter(row=>row.saved).length
    try {
      for(const [index,row] of rows.entries()) {
        if(row.saved) continue
        const extension='.'+row.file.name.split('.').pop()?.toLowerCase()
        if(!limits.extensions.includes(extension) || !row.file.size || row.file.size>limits.bytes || !row.name.trim() || !row.reviewed) {
          patch(index,{message:'Check file type, size, name and review confirmation.'});continue
        }
        const body=new FormData()
        for(const [key,value] of Object.entries({batch_id:batch,person_name:row.name.trim(),sacrament_type:category,record_data:JSON.stringify(row.fields),review_confirmed:'true',document_type:'Scanned Certificate'})) body.set(key,value)
        body.set('file',row.file)
        try {await upload(body,index);saved++;patch(index,{progress:100,message:'Saved',saved:true})}
        catch(error){patch(index,{message:error instanceof Error?error.message:'Upload failed'})}
      }
      setNotice(saved+' of '+rows.length+' saved.')
      if(saved) onSaved()
    } finally {setBusy(false)}
  }
  return <details className="role-card my-3"><summary>Upload a batch of scans</summary>
    {limits && <p>Up to {limits.files} files per batch, {limits.bytes/1048576} MB each. Daily batch allowance: {limits.daily} files.</p>}
    <fieldset disabled={busy || !limits}><label>Select scans<input multiple type="file" accept={limits?.extensions.join(',')} onChange={e=>{
      const files=Array.from(e.target.files||[])
      if(!limits || !files.length) return
      if(files.length>limits.files){setNotice('Choose at most '+limits.files+' files.');return}
      setBatch(crypto.randomUUID());setNotice('');setRows(files.map(file=>({file,name:'',fields:{},reviewed:false,progress:0,message:'',saved:false})))
    }}/></label>
    {rows.map((row,i)=><details className="role-card my-2" key={batch+'-'+i}><summary>{row.file.name} · {row.message || 'Awaiting review'} <progress max={100} value={row.progress}/></summary>
      <fieldset disabled={row.saved}><label>Name on record<input value={row.name} onChange={e=>patch(i,{name:e.target.value,reviewed:false})}/></label>
      {['baptismal','confirmation','marriage'].includes(category) && <TemplateDataFields sacramentType={category} value={row.fields} onChange={fields=>patch(i,{fields,reviewed:false})}/>}
      <label><input type="checkbox" checked={row.reviewed} onChange={e=>patch(i,{reviewed:e.target.checked})}/> I reviewed this scan and its fields.</label>
      <button type="button" onClick={()=>setRows(all=>all.filter((_,idx)=>idx!==i))}>Remove file</button></fieldset>
    </details>)}</fieldset>
    <button type="button" disabled={busy||!rows.some(row=>!row.saved)} onClick={()=>void submit()} className="portal-primary-btn">{busy?'Uploading…':'Save reviewed scans'}</button>
    <p role="status">{notice}</p>
  </details>
}
