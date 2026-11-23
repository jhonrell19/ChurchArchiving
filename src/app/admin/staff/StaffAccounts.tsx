'use client'

import { useEffect, useState } from 'react'

type Staff = {
  id: number
  email: string
  firstName: string | null
  surname: string | null
  role: string
  emailVerified: boolean
  accountEnabled: boolean
}
export default function StaffAccounts() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [form, setForm] = useState({ email: '', firstName: '', surname: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const response = await fetch('/api/admin/staff', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load staff')
      setStaff(result.staff || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load staff')
    }
  }
  useEffect(() => { void load() }, [])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Invitation failed')
      setForm({ email: '', firstName: '', surname: '' })
      setNotice('Invitation sent. The staff member must set a password and enroll MFA.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation failed')
    } finally { setBusy(false) }
  }

  async function changeStatus(item: Staff) {
    if (busy || !window.confirm(`${item.accountEnabled ? 'Disable' : 'Enable'} staff account ${item.email}?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.id, accountEnabled: !item.accountEnabled }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Update failed')
      setNotice('Staff access updated. Previous sessions have been revoked.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-6">
      <a href="/admin" className="text-emerald-800 underline">Back to Super Admin</a>
      <h1 className="text-2xl font-bold">Church Staff Accounts</h1>
      <p className="text-base text-slate-600">Invite document-processing staff. Staff cannot manage the website, fees, Mass recordings or other accounts. MFA is required.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
      <form onSubmit={invite} className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">Invite Church Staff</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['firstName', 'surname', 'email'] as const).map(key => <label key={key} className="block text-sm font-medium capitalize">
            {key === 'firstName' ? 'First Name' : key === 'surname' ? 'Surname' : 'Email'}
            <input required maxLength={120} type={key === 'email' ? 'email' : 'text'} value={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"/>
          </label>)}
        </div>
        <button disabled={busy} className="mt-4 rounded-lg bg-emerald-800 px-5 py-3 text-white disabled:opacity-50">Send staff invitation</button>
      </form>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Staff access</h2>
        <div className="mt-3 space-y-3">
          {staff.map(item => <div key={item.id} className="flex flex-col gap-2 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold">{item.firstName} {item.surname}</p>
              <p className="break-all text-sm text-slate-600">{item.email}</p>
              <p className="text-sm text-slate-600">{item.role === 'BURIAL_ADMIN' ? 'Legacy role — migrate to STAFF' : 'Church Staff'} · {item.emailVerified ? 'Email verified' : 'Invitation pending'} · {item.accountEnabled ? 'Active' : 'Disabled'}</p></div>
            <button disabled={busy} onClick={() => void changeStatus(item)}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {item.accountEnabled ? 'Disable access' : 'Enable access'}
            </button>
          </div>)}
          {!staff.length && <p className="py-4 text-slate-600">No staff accounts yet.</p>}
        </div>
      </section>
    </div>
  </main>
}
