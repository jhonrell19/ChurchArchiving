'use client'
import { useEffect, useState } from 'react'

export default function VerificationPage() {
  const [message,setMessage] = useState('Checking membership status…')
  const [canSubmit,setCanSubmit] = useState(false)
  const [busy,setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/verification',{cache:'no-store'}).then(async r => {
      const data = await r.json()
      if (!r.ok) throw Error(data.message)
      setCanSubmit(data.status === 'pending' && !data.submitted)
      setMessage(data.submitted ? 'Evidence received. Membership status: '+data.status : 'Membership status: '+data.status)
    }).catch(() => setMessage('Sign in again to check your membership status.'))
  },[])
  return <main className="parish-workspace"><a href="/login">← Sign in</a><h1>Verify parish membership</h1>
    <p role="status">{message}</p>{canSubmit && <form className="parish-filters" onSubmit={async e => {
      e.preventDefault(); const data = new FormData(e.currentTarget); const image=data.get('proof')
      if (!(image instanceof File) || !image.size || image.size>3145728) {setMessage('Choose an image up to 3 MB.');return}
      setBusy(true)
      try {
        const r = await fetch('/api/verification',
          {method:'POST',headers:{'Content-Type':image.type,'X-Parish-Record':encodeURIComponent(String(data.get('record')))},body:image})
        const result = await r.json(); setMessage(result.message); if (r.ok || r.status===409) setCanSubmit(false)
      } catch {setMessage('Upload interrupted. Refresh to check whether your evidence was received.')}
      finally {setBusy(false)}
    }}>
      <label>Church record reference, or baptismal name and year<input required name="record" minLength={3} maxLength={160}/></label>
      <label>ID photo (JPEG or PNG, up to 3 MB)<input type="file" name="proof" required accept="image/jpeg,image/png"/></label>
      <button disabled={busy}>{busy?'Submitting…':'Submit for parish review'}</button>
    </form>}<p>Your ID is available to the parish membership reviewer. <a href="/privacy">Privacy notice</a></p></main>
}
