'use client'
import OfficeHeading from '@/components/OfficeHeading'
import { supervisorProvisioned } from '@/lib/staffProvisioning'
import PasswordField from '@/components/auth/PasswordField'

import { useEffect, useState } from 'react'

type Staff = {
  id: number
  email: string
  firstName: string | null
  surname: string | null
  role: string
  membershipStatus: string
  emailVerified: boolean
  accountEnabled: boolean
}
export default function StaffAccounts() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [form, setForm] = useState({ email: '', firstName: '', surname: '', password: '' })
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

  async function createStaff(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/admin/staff/managed', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'create' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Account creation failed')
      setForm({ email: '', firstName: '', surname: '', password: '' })
      setNotice('Staff account created. Share the login privately. Staff will enroll their authenticator at first sign-in.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed')
    } finally { setBusy(false) }
  }

  const [editing, setEditing] = useState<number | null>(null)
  const [details, setDetails] = useState({ firstName: '', surname: '', email: '', password: '' })

  async function update(item: Staff, change: object, success: string, managed = false) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await fetch(managed ? '/api/admin/staff/managed' : '/api/admin/staff', {
        method: managed ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.id, ...change }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Update failed')
      setNotice(success)
      setEditing(null)
      setDetails({ email: '', firstName: '', surname: '', password: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return <main className="office-page">
    <div className="office-inner space-y-6">
      <OfficeHeading title="Church Staff Accounts"/>
      <p className="text-base text-slate-600">Assign a login email and password. Each staff member pairs their own authenticator when they first sign in.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-rose-50 p-4 text-navy-mid">{notice}</p>}
      <div className="staff-management-grid"><form onSubmit={createStaff} className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">Create Church Staff account</h2>
        <div className="staff-account-fields grid gap-3 sm:grid-cols-2">
          {(['firstName', 'surname', 'email'] as const).map(key => <label key={key} className="block text-sm font-medium capitalize">
            {key === 'firstName' ? 'First Name' : key === 'surname' ? 'Surname' : 'Email'}
            <input required maxLength={120} type={key === 'email' ? 'email' : 'text'} value={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"/>
          </label>)}
        </div>
        <PasswordField label="Staff password" guidance required autoComplete="new-password" minLength={12}
          className="block min-h-11 w-full rounded border px-3" value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}/>
        <button disabled={busy} className="mt-4 rounded-lg bg-navy px-5 py-3 text-white disabled:opacity-50">Create staff account</button>
      </form>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Staff access</h2>
        <div className="mt-3 space-y-3">
          {staff.map(item => <div key={item.id} className="space-y-3 border-b py-4">
            <div><p className="font-semibold">{item.firstName} {item.surname}</p>
              <p className="break-all text-sm text-slate-600">{item.email}</p>
              <p className="text-sm text-slate-600">{item.role === 'BURIAL_ADMIN' ? 'Legacy role — migrate to STAFF' : 'Church Staff'} · {supervisorProvisioned(item) ? 'Admin-managed login' : item.emailVerified ? 'Email verified' : 'Invitation pending'} · {item.accountEnabled ? 'Active' : 'Disabled'}</p></div>
            <button disabled={busy} aria-expanded={editing === item.id} className="mr-3 min-h-11 rounded-lg border px-4"
              onClick={() => {
                setDetails({ email: item.email, firstName: item.firstName || '', surname: item.surname || '', password: '' })
                setEditing(editing === item.id ? null : item.id)
              }}>{editing === item.id ? 'Close editor' : 'Edit account'}</button>
            <button disabled={busy} onClick={() => {
              if (window.confirm(`${item.accountEnabled ? 'Disable' : 'Enable'} access for ${item.email}?`))
                void update(item, { accountEnabled: !item.accountEnabled }, 'Staff access updated.')
            }}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {item.accountEnabled ? 'Disable access' : 'Enable access'}
            </button>
            {editing === item.id && <div className="space-y-4 rounded-lg bg-slate-50 p-4">
              <form className="grid gap-3 sm:grid-cols-3" onSubmit={e => {
                e.preventDefault()
                void update(item, { action: 'name', firstName: details.firstName, surname: details.surname }, 'Staff name updated.')
              }}>
                {(['firstName', 'surname'] as const).map(key => <label key={key}>
                  {key === 'firstName' ? 'First name' : 'Surname'}
                  <input required maxLength={100} value={details[key]} className="block min-h-11 w-full rounded border bg-white px-3"
                    onChange={e => setDetails({ ...details, [key]: e.target.value })}/>
                </label>)}
                <button disabled={busy} className="min-h-11 self-end rounded border bg-white px-4">Save name</button>
              </form>
              <form className="grid gap-2" onSubmit={e => {
                e.preventDefault()
                if (window.confirm(`Assign these credentials to ${item.email} and sign them out?`))
                  void update(item, { action: 'credentials', email: details.email, password: details.password }, 'Login updated. Staff can now sign in using these credentials.', true)
              }}>
                <label>Staff login email
                  <input type="email" required value={details.email} className="block min-h-11 w-full rounded border bg-white px-3"
                    onChange={e => setDetails({ ...details, email: e.target.value })}/>
                </label>
                <PasswordField label="New password" guidance required autoComplete="new-password" minLength={12}
                  className="block min-h-11 w-full rounded border bg-white px-3" value={details.password}
                  onChange={e => setDetails({ ...details, password: e.target.value })}/>
                <p>Use at least 12 characters, including uppercase, lowercase, a number and a symbol.</p>
                <button disabled={busy} className="min-h-11 justify-self-start rounded border bg-white px-4">Save login email and password</button>
              </form>
              <button disabled={busy} className="mr-3 min-h-11 rounded border bg-white px-4" onClick={() => {
                if (window.confirm('Sign this staff member out and require authenticator enrollment again?'))
                  void update(item, { action: 'resetMfa' }, 'Authenticator reset. Staff must enroll again at sign-in.', true)
              }}>Reset authenticator</button>
              {!item.accountEnabled && <button disabled={busy} className="min-h-11 rounded border bg-white px-4 text-red-800" onClick={() => {
                if (window.confirm('Permanently delete the disabled staff login ' + item.email + '?'))
                  void update(item, { action: 'delete' }, 'Staff account deleted.', true)
              }}>Delete disabled account</button>}
            </div>}
          </div>)}
          {!staff.length && <p className="py-4 text-slate-600">No staff accounts yet.</p>}
        </div>
      </section></div>
    </div>
  </main>
}
