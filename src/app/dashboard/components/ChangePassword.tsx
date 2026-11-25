'use client'

import { useState } from 'react'
import PasswordField from '@/components/auth/PasswordField'

export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const common = { required: true, className: 'w-full rounded-lg border bg-white p-3' }
  return <details className="mb-4 rounded-xl border bg-white p-5">
    <summary className="cursor-pointer font-semibold">Change password</summary>
    <form className="mt-4 space-y-4" onSubmit={async e => {
      e.preventDefault()
      if (busy) return
      if (next !== confirm) { setMessage('The new passwords do not match.'); return }
      setBusy(true); setMessage('')
      try {
        const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: current, newPassword: next }) })
        if (!res.ok) throw Error((await res.json()).message || 'Change failed.')
        window.location.replace('/login')
      } catch (err) { setMessage(err instanceof Error ? err.message : 'Please try again.') }
      finally { setBusy(false) }
    }}>
      <p>After saving, sign in again with your new password.</p>
      <PasswordField {...common} label="Current password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}/>
      <PasswordField {...common} guidance label="New password" autoComplete="new-password" minLength={12} value={next} onChange={e => setNext(e.target.value)}/>
      <PasswordField {...common} label="Confirm new password" match={next} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)}/>
      <button disabled={busy} className="rounded-lg border px-4 py-3">{busy ? 'Saving…' : 'Save new password'}</button>
      <a href="/forgot-password" className="ml-4 underline">Forgot your password?</a>
      {message && <p role="alert">{message}</p>}
    </form>
  </details>
}
