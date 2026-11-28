'use client'

import {useCallback,useEffect,useState} from 'react'
import {useFeedback} from '@/components/ui/FeedbackProvider'

type Media={id:string;name:string;type:'image'|'video';url:string;bytes:number;displaySeconds:number;durationSeconds:number|null}
type Notice={id:number;title:string;body:string;category:string;date:string|null;starts:string|null;ends:string|null;priority:number;media:Media[]}
const categories=['Event','Schedule','Ministry','Sacrament','Public calendar notice','General']
const emptyForm={title:'',body:'',category:'Public calendar notice',date:'',starts:'',ends:'',priority:'0'}
type NoticeForm=typeof emptyForm
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const fieldClass='w-full min-h-12 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-3 focus:outline-amber-400'
const formatSize=(n:number)=>(n/1024/1024).toFixed(1)+' MB'
function prettyStatus(notice:Notice) {
  const now=today()
  if(notice.ends&&notice.ends<now)return 'Expired · hidden'
  if(notice.starts&&notice.starts>now)return 'Scheduled'
  return 'Published'
}

export default function AnnouncementsPage(){
  const {toast,confirmAction}=useFeedback()
  const [notices,setNotices]=useState<Notice[]>([])
  const [selected,setSelected]=useState<number|null>(null)
  const [form,setForm]=useState<NoticeForm>(emptyForm)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [storageReady,setStorageReady]=useState(false)
  const [files,setFiles]=useState<File[]>([])
  const [photoSeconds,setPhotoSeconds]=useState(8)
  const [pending,setPending]=useState<number|null>(null)
  const [note,setNote]=useState('')
  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await fetch('/api/admin/notices',{cache:'no-store'})
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Cannot load announcements')
      setNotices(Array.isArray(data.notices)?data.notices:[])
      setStorageReady(!!data.storageReady)
    }catch(error){toast.error(error instanceof Error?error.message:'Announcements unavailable')}
    finally{setLoading(false)}
  },[toast])
  const refreshQueue=useCallback(async()=>{
    try{
      const res=await fetch('/api/admin/notices/dispatch',{cache:'no-store'})
      if(!res.ok)return
      const data=await res.json()
      setPending(data.enabled?Number(data.pending||0):null)
    }catch{setPending(null)}
  },[])
  useEffect(()=>{
    queueMicrotask(()=>{void load();void refreshQueue()})
  },[load,refreshQueue])
  const selectedNotice=notices.find(n=>n.id===selected)
  const change=(key:keyof NoticeForm,value:string)=>setForm(previous=>({...previous,[key]:value}))
  const edit=(n:Notice)=>{
    setSelected(n.id)
    setForm({title:n.title,body:n.body,category:n.category||'Event',
      date:n.date||'',starts:n.starts||'',ends:n.ends||'',priority:String(n.priority||0)})
    setFiles([])
    document.getElementById('notice-title')?.focus()
  }
  const reset=()=>{
    setSelected(null)
    setFiles([])
    setForm({...emptyForm,starts:today(),ends:today()})
    setNote('')
  }
  async function save(event:React.FormEvent){
    event.preventDefault()
    if(!form.title.trim()||!form.body.trim()||!form.starts||!form.ends||form.starts>form.ends){
      toast.warning('Enter a title, text, and valid publication dates.');return
    }
    setBusy(true)
    try{
      const res=await fetch(selected?'/api/admin/notices/'+selected:'/api/admin/notices',{
        method:selected?'PUT':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,date:form.date||null}),
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Save failed')
      const id=selected??Number(data.id)
      setSelected(id)
      if (files.length) {
        try { await upload(id) }
        catch (error) {
          const message = 'Announcement saved. ' + (error instanceof Error ? error.message : 'Media upload failed.')
          setNote(message); toast.error(message); await load(); return
        }
      }
      await load()
      setNote('Announcement saved.')
      toast.success('Announcement saved.')
    }catch(error){toast.error(error instanceof Error?error.message:'Could not save announcement')}
    finally{setBusy(false)}
  }
  async function upload(id:number){
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      body.append('displaySeconds', String(photoSeconds))
      const response = await fetch('/api/admin/notices/'+id+'/media', {method:'POST',body})
      if (!response.ok) {
        const data = await response.json().catch(()=>({}))
        throw Error(data.message || ('Could not upload '+file.name+' (HTTP '+response.status+').'))
      }
      setFiles(remaining=>remaining.filter(candidate=>candidate!==file))
    }
  }
  async function removeAttachment(media:Media){
    if(!selected||!await confirmAction('Remove this picture or clip from the announcement?'))return
    setBusy(true)
    try{
      const res=await fetch('/api/admin/notices/'+selected+'/media/'+media.id,{method:'DELETE'})
      if(!res.ok)throw Error('Could not delete the media file')
      await load()
      toast.success('Media deleted.')
    }catch{toast.error('Could not remove media. Try again.')}
    finally{setBusy(false)}
  }
  async function removeNotice(n:Notice){
    if(!await confirmAction('Remove "'+n.title+'" from all public pages? Uploaded media will also be deleted.'))return
    setBusy(true)
    try{
      const res=await fetch('/api/admin/notices/'+n.id,{method:'DELETE'})
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Removal failed')
      if(selected===n.id)reset()
      await load()
      toast.success(data.remainingMedia?'Removed from the website. Some media awaits cleanup.':'Announcement removed.')
    }catch(error){toast.error(error instanceof Error?error.message:'Unable to remove announcement')}
    finally{setBusy(false)}
  }
  async function queueAnnouncement(n:Notice){
    if(prettyStatus(n)!=='Published'){
      toast.warning('Send notices only while the announcement is currently published.');return
    }
    if(!await confirmAction('Queue one email/SMS announcement update for each parishioner who opted in? No messages will be sent until you process the queue.'))return
    setBusy(true)
    try{
      const res=await fetch('/api/admin/notices/'+n.id+'/notify',{method:'POST'})
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Could not queue updates')
      setNote('Queued '+data.queued+' update(s). Already queued: '+data.alreadyQueued+'. Only opted-in accounts qualify.')
      await refreshQueue()
      toast.success('Announcement updates queued.')
    }catch(error){toast.error(error instanceof Error?error.message:'Queue unavailable')}
    finally{setBusy(false)}
  }
  async function dispatch(){
    setBusy(true)
    try{
      const res=await fetch('/api/admin/notices/dispatch',{method:'POST'})
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Dispatch failed')
      setNote('Processed '+data.processed+' queued event(s). '+data.acceptedChannels+
        ' provider acceptance(s); device delivery is not confirmed.')
      await refreshQueue()
    }catch(error){toast.error(error instanceof Error?error.message:'Dispatch failed')}
    finally{setBusy(false)}
  }
  async function cleanup(){
    setBusy(true)
    try{
      const res=await fetch('/api/admin/notices/cleanup',{method:'POST'})
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(data.message||'Cleanup failed')
      setNote('Expired announcements purged: '+data.removedNotices+'. Media removed: '+data.removedMedia+
        (data.failedMedia?' · Media pending retry: '+data.failedMedia:''))
      await load()
    }catch(error){toast.error(error instanceof Error?error.message:'Cleanup unavailable')}
    finally{setBusy(false)}
  }

  return <div className="max-w-6xl space-y-6 text-slate-900">
    <section className="role-banner">
      <p className="portal-eyebrow">Super Admin · Parish communications</p>
      <h2>Announcements and notices</h2>
      <p>Schedule events, add up to four pictures and one MP4 clip, and choose whether to notify consenting parishioners. Expired announcements disappear from public pages automatically.</p>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(290px,365px)]">
      <section className="role-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="role-subtitle">{selected?'Edit announcement':'New announcement'}</h3>
          <button type="button" onClick={reset} disabled={busy} className="portal-secondary-btn">New announcement</button>
        </div>
        <form onSubmit={save} className="grid gap-4">
          <label className="grid gap-1 font-semibold" htmlFor="notice-title">Title *
            <input id="notice-title" className={fieldClass} maxLength={180} required value={form.title}
              onChange={e=>change('title',e.target.value)} placeholder="e.g. Sunday Homily schedule"/>
          </label>
          <label className="grid gap-1 font-semibold" htmlFor="notice-body">Announcement details *
            <textarea id="notice-body" className={fieldClass} rows={4} maxLength={2000} required value={form.body}
              onChange={e=>change('body',e.target.value)} placeholder="What should parishioners know?"/>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-semibold" htmlFor="notice-category">Category
              <select id="notice-category" className={fieldClass} value={form.category} onChange={e=>change('category',e.target.value)}>
                {categories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="grid gap-1 font-semibold" htmlFor="notice-event-date">Event date (optional)
              <input id="notice-event-date" type="date" className={fieldClass} value={form.date} onChange={e=>change('date',e.target.value)}/>
            </label>
            <label className="grid gap-1 font-semibold" htmlFor="notice-start">Show from *
              <input id="notice-start" type="date" className={fieldClass} required value={form.starts} onChange={e=>change('starts',e.target.value)}/>
            </label>
            <label className="grid gap-1 font-semibold" htmlFor="notice-end">Remove after *
              <input id="notice-end" type="date" min={form.starts} className={fieldClass} required value={form.ends} onChange={e=>change('ends',e.target.value)}/>
            </label>
            <label className="grid gap-1 font-semibold" htmlFor="notice-priority">Slideshow priority
              <input id="notice-priority" type="number" min={-100} max={100} className={fieldClass} value={form.priority} onChange={e=>change('priority',e.target.value)}/>
            </label>
          </div>
          {storageReady?<div className="grid gap-3">
            <label className="grid gap-1 font-semibold" htmlFor="notice-media">Add pictures or a short MP4 clip
              <input id="notice-media" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4"
                disabled={busy} className={fieldClass} onChange={e=>{setFiles(Array.from(e.target.files||[]));e.target.value=''}}/>
            </label>
            {files.length>0 && <p>{files.map(file=>file.name).join(', ')}</p>}
            <label htmlFor="notice-photo-seconds" className="grid gap-1 font-semibold">Seconds per photo (5–30)
              <input id="notice-photo-seconds" type="number" min={5} max={30} value={photoSeconds}
                className={fieldClass} onChange={e=>setPhotoSeconds(Number(e.target.value))}/>
            </label>
          </div>:<p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{loading ? 'Checking media storage…' : 'Media requires private Supabase Storage on the ifimarag web service. You can still publish text.'}</p>}
          <p className="text-sm text-slate-600">JPG, PNG or WebP up to 5 MB each. MP4 up to 18 MB and 30 seconds. Up to four photos and one clip per announcement.</p>
          <p className="text-sm text-slate-600">Publication dates use Philippine time. The event appears on its event date in the calendar, or throughout the publication period if no event date is entered. No calendar notice remains visible after expiry.</p>
          <button className="portal-primary-btn" type="submit" disabled={busy}>
            {busy?'Saving…':selected?'Save announcement changes':'Publish announcement'}
          </button>
        </form>
        {selected && selectedNotice && <section className="mt-6 border-t border-slate-200 pt-5 space-y-3">
          <h4 className="role-subtitle">Pictures and short video</h4>
          <p className="text-sm text-slate-600">Images: JPG, PNG or WebP, maximum 5 MB each. Video: MP4 only, maximum 18 MB and 30 seconds. Four pictures plus one clip, 24 MB combined per announcement.</p>
          {selectedNotice.media.length>0&&<div className="grid gap-3 sm:grid-cols-2">
            {selectedNotice.media.map(media=><article key={media.id} className="rounded-lg border border-slate-200 p-2">
              {media.type==='video'
                ?<video src={media.url} controls preload="metadata" className="h-36 w-full rounded object-cover"/>
                :<img src={media.url} alt={'Attached '+media.name} loading="lazy" className="h-36 w-full rounded object-cover"/>}
              <p className="mt-2 text-sm font-medium break-words">{media.name} · {formatSize(media.bytes)}</p>
              <p className="text-xs text-slate-600">{media.type==='video'?Math.round(media.durationSeconds||0)+' sec clip':media.displaySeconds+' sec display'}</p>
              <button type="button" className="mt-2 text-base font-semibold text-red-700 underline" disabled={busy} onClick={()=>void removeAttachment(media)}>Remove file</button>
            </article>)}
          </div>}
          <button type="button" className="portal-secondary-btn" onClick={()=>void queueAnnouncement(selectedNotice)} disabled={busy||prettyStatus(selectedNotice)!=='Published'}>
            Queue announcement email/SMS alerts
          </button>
        </section>}
      </section>
      <aside className="space-y-4">
        <section className="role-card">
          <h3 className="role-subtitle">Notification delivery</h3>
          <p className="my-3 text-sm text-slate-600">Only parishioners who explicitly enabled announcement alerts may receive them. Delivery uses your existing Resend/Gmail and txtBee configuration.</p>
          <p className="text-lg font-bold">{pending===null?'Outbox not enabled':pending+' queued recipient(s)'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="portal-secondary-btn" onClick={()=>void refreshQueue()}>Refresh queue</button>
            <button type="button" className="portal-primary-btn" disabled={busy||!pending} onClick={()=>void dispatch()}>Send next 5 alerts</button>
          </div>
          <p className="mt-3 text-xs text-slate-600">Gateway acceptance does not mean an SMS arrived. Uncertain sends are not blindly retried.</p>
        </section>
        <section className="role-card">
          <h3 className="role-subtitle">Expired announcement cleanup</h3>
          <p className="my-3 text-sm text-slate-600">Notices are hidden automatically when their publication period ends. Scheduled cleanup removes stored pictures, clips, and expired rows. You can run cleanup manually.</p>
          <button type="button" className="portal-secondary-btn" disabled={busy} onClick={()=>void cleanup()}>Clean up expired notices</button>
        </section>
        {note&&<p role="status" className="role-card text-sm">{note}</p>}
      </aside>
    </div>
    <section className="role-card">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="role-subtitle">Current and scheduled announcements</h3>
        <button type="button" className="portal-secondary-btn" onClick={()=>void load()}>Refresh</button>
      </div>
      {loading?<p>Loading announcements…</p>:notices.length===0?<p>No announcements yet.</p>:
        <div className="grid gap-3 md:grid-cols-2">
          {notices.map(n=><article key={n.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h4 className="text-lg font-bold">{n.title}</h4>
              <span className="text-sm font-semibold text-navy-mid">{prettyStatus(n)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{n.category} · {n.starts||'—'} to {n.ends||'—'}</p>
            <p className="mt-2 whitespace-pre-line text-base">{n.body}</p>
            <p className="mt-2 text-sm text-slate-600">{n.media.length} attachment(s)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="portal-secondary-btn" disabled={busy} onClick={()=>edit(n)}>Edit and manage files</button>
              <button type="button" className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-base font-semibold text-red-700" onClick={()=>void removeNotice(n)}>Remove</button>
            </div>
          </article>)}
        </div>}
    </section>
  </div>
}
