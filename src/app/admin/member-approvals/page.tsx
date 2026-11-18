'use client'

import { useEffect, useState } from 'react'

type Member = {
  id: number
  firstName: string | null
  middleName: string | null
  surname: string | null
  email: string
  emailVerified: boolean
  createdAt: string
}

export default function MemberApprovalsPage() {
  const [users, setUsers] = useState<Member[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch('/api/admin/membership', { cache: 'no-store' })
    if (!res.ok) { setMessage('Unable to load membership requests'); return }
    const data = await res.json()
    setUsers(data.users || [])
  }
  useEffect(() => { void load() }, [])

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
        body: JSON.stringify({ userId: member.id, decision, reason }),
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

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <a href="/admin" className="text-blue-800 underline">Back to Main Admin</a>
      <h1 className="mt-4 mb-2 text-2xl font-bold">Parish membership approvals</h1>
      <p className="mb-4">Only accounts with a verified email can be approved or rejected.</p>
      {message && <p role="status" className="mb-4 rounded bg-amber-50 p-3">{message}</p>}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b bg-slate-100"><th className="p-3">Member</th>
            <th className="p-3">Email</th><th className="p-3">Email verified</th>
            <th className="p-3">Review reason</th><th className="p-3">Action</th></tr></thead>
          <tbody>{users.map(u => <tr className="border-b" key={u.id}>
            <td className="p-3">{[u.firstName, u.middleName, u.surname].filter(Boolean).join(' ') || 'Unspecified'}</td>
            <td className="p-3">{u.email}</td><td className="p-3">{u.emailVerified ? 'Yes' : 'No'}</td>
            <td className="p-3"><input aria-label={`Review reason for ${u.email}`} className="rounded border p-2"
              maxLength={500} value={reasons[u.id] || ''} disabled={!u.emailVerified || busy !== null}
              onChange={event => { const value = event.target.value; setReasons(previous => ({ ...previous, [u.id]: value })) }} /></td>
            <td className="p-3 flex gap-2">
              <button disabled={!u.emailVerified || busy !== null} onClick={() => void decide(u, 'approved')}
                className="rounded bg-emerald-800 px-3 py-2 text-white disabled:opacity-40">Approve</button>
              <button disabled={!u.emailVerified || busy !== null} onClick={() => void decide(u, 'rejected')}
                className="rounded bg-rose-800 px-3 py-2 text-white disabled:opacity-40">Reject</button>
            </td></tr>)}</tbody>
        </table>
      </div>
      {!users.length && <p className="mt-4">No pending parishioners.</p>}
    </div>
  </main>
}
