'use client'
import OfficeHeading from '@/components/OfficeHeading'

import { useEffect, useState } from 'react'

type Member = {
  id: number
  firstName: string | null
  middleName: string | null
  surname: string | null
  email: string
  evidenceHint: string | null
  emailVerified: boolean
  createdAt: string
}

export default function MemberApprovalsPage() {
  const [page,setPage] = useState(1)
  const [next,setNext] = useState(false)
  const [enabled,setEnabled] = useState(false)
  const [matches,setMatches] = useState<Record<number,string>>({})
  const [checked,setChecked] = useState<Record<number,boolean>>({})
  const [users, setUsers] = useState<Member[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch('/api/admin/membership?page='+page, { cache: 'no-store' })
    if (!res.ok) { setMessage('Unable to load membership requests'); return }
    const data = await res.json()
    setUsers(data.users || [])
    setNext(data.hasNext); setEnabled(data.evidenceEnabled)
  }
  useEffect(() => { void load() }, [page])

  async function decide(member: Member, decision: 'approved' | 'rejected') {
    const reason = (reasons[member.id] || '').trim()
    if (reason.length < 5 || reason.length > 500) {
      setMessage('Enter a reason between 5 and 500 characters before submitting your decision.'); return
    }
    setBusy(member.id)
    setMessage('')
    try {
      const res = await fetch('/api/admin/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, decision, reason, certificateNumber:matches[member.id], checked:checked[member.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Review failed')
      setMessage(`Member ${member.id}: ${decision}`)
      setReasons(previous => ({ ...previous, [member.id]: '' }))
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review failed')
    } finally { setBusy(null) }
  }

  return <main className="office-page administration-photo">
    <div className="office-inner">
      <OfficeHeading title="Parish membership approvals"/>
      <p className="mb-4">Only accounts with a verified email can be approved or rejected.</p>
      {message && <p role="status" className="mb-4 rounded bg-amber-50 p-3">{message}</p>}
      <div className="approval-list overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b bg-slate-100"><th className="p-3">Member</th>
            <th className="p-3">Email</th><th className="p-3">Email verified</th>
            {enabled && <th className="p-3">Evidence and church record</th>}<th className="p-3">Review reason</th><th className="p-3">Action</th></tr></thead>
          <tbody>{users.map(u => <tr className="border-b" key={u.id}>
            <td data-label="Member" className="p-3">{[u.firstName, u.middleName, u.surname].filter(Boolean).join(' ') || 'Unspecified'}</td>
            <td data-label="Email" className="p-3">{u.email}</td><td data-label="Email verified" className="p-3">{u.emailVerified ? 'Yes' : 'No'}</td>
            {enabled && <td data-label="Evidence and church record" className="p-3">{u.evidenceHint ? <><a className="underline" href={`/api/admin/membership/${u.id}/evidence`} target="_blank" rel="noreferrer">Open private ID</a><p>{u.evidenceHint}</p>
              <label>Baptismal certificate number<input className="block border p-1" maxLength={100} value={matches[u.id] || ''} onChange={e=>setMatches({...matches,[u.id]:e.target.value})}/></label>
              <label><input type="checkbox" checked={!!checked[u.id]} onChange={e=>setChecked({...checked,[u.id]:e.target.checked})}/> I compared the ID and church record.</label></>:'Awaiting evidence'}</td>}
            <td data-label="Review reason" className="p-3"><input aria-label={`Review reason for ${u.email}`} className="rounded border p-2"
              maxLength={500} value={reasons[u.id] || ''} disabled={!u.emailVerified || busy !== null}
              onChange={event => { const value = event.target.value; setReasons(previous => ({ ...previous, [u.id]: value })) }} /></td>
            <td data-label="Action" className="p-3 flex gap-2">
              <button disabled={!u.emailVerified || busy !== null} onClick={() => void decide(u, 'approved')}
                className="rounded bg-emerald-800 px-3 py-2 text-white disabled:opacity-40">Approve</button>
              <button disabled={!u.emailVerified || busy !== null} onClick={() => void decide(u, 'rejected')}
                className="rounded bg-rose-800 px-3 py-2 text-white disabled:opacity-40">Reject</button>
            </td></tr>)}</tbody>
        </table>
      </div>
      <nav className="parish-pager" aria-label="Member review pages"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={!next} onClick={()=>setPage(page+1)}>Next</button></nav>
      {!users.length && <p className="mt-4">No pending parishioners.</p>}
    </div>
  </main>
}
