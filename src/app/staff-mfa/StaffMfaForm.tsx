'use client'

import { useEffect, useState } from 'react'
import { useRefreshOnHistoryRestore } from '@/hooks/useRefreshOnHistoryRestore'

export default function StaffMfaForm() {
  useRefreshOnHistoryRestore()
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [roleHome, setRoleHome] = useState('/login')

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/auth/staff-mfa', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage(data.message || 'Please sign in again.'); return }
      setEnrolled(Boolean(data.enrolled))
      if (!data.enrolled) {
        const setup = await fetch('/api/auth/staff-mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup' }) })
        const content = await setup.json().catch(() => ({}))
        if (setup.ok) setSecret(content.secret || '')
        else setMessage(content.message || 'Could not start authenticator setup.')
      }
    })()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/auth/staff-mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', code }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage(data.message || 'Authentication failed.'); return }
      const destination = ['/staff', '/admin'].includes(data.destination) ? data.destination : '/login'
      if (Array.isArray(data.recoveryCodes)) {
        setRoleHome(destination)
        setRecoveryCodes(data.recoveryCodes)
        setMessage('MFA enabled. Save these one-time recovery codes privately before continuing.')
      } else {
        window.location.replace(destination)
      }
    } catch {
      setMessage('Cannot reach the security service. Please retry.')
    } finally { setBusy(false) }
  }

  async function startAgain() {
    setBusy(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not cancel the pending sign-in.')
      window.location.replace('/login')
    } catch {
      setMessage('Could not cancel sign-in. Please try again.')
      setBusy(false)
    }
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-12">
    <section className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-7 shadow-sm space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Staff two-factor authentication</h1>
      <p className="text-sm text-slate-700">Administrators and church staff must verify an authenticator code before accessing parish records.</p>
      {enrolled === false && secret && !recoveryCodes && <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-2">
        <p className="font-medium text-sm">First-time setup</p>
        <p className="text-sm">Open Google Authenticator, Microsoft Authenticator, or another TOTP app. Choose <strong>Add account → Enter setup key</strong>.</p>
        <p className="text-sm">Account name: <strong>Smart Parish Staff</strong></p>
        <p className="text-sm">Setup key (private):</p>
        <code className="block rounded bg-white border border-slate-300 p-3 font-mono break-all text-sm select-all">{secret}</code>
        <p className="text-xs">Select time-based (TOTP), then enter the six-digit code below. Never share this key.</p>
      </div>}
      {!recoveryCodes && enrolled !== null && <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="mfa-code">{enrolled ? 'Authenticator code or one-time recovery code' : 'Six-digit code from your authenticator app'}</label>
        <input id="mfa-code" required value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900" placeholder="000000" />
        <button disabled={busy} className="w-full rounded-lg bg-blue-900 text-white py-3 disabled:opacity-60">{busy ? 'Verifying...' : 'Verify and sign in'}</button>
      </form>}
      {recoveryCodes && <div className="space-y-3 rounded-lg border border-emerald-200 p-4">
        <h2 className="font-semibold">Save your recovery codes</h2>
        <p className="text-sm">Each code works once. Save them in a password manager or offline secure location. They will not be shown again.</p>
        <pre className="text-sm whitespace-pre-wrap break-all bg-slate-100 p-3 rounded select-all">{recoveryCodes.join('\n')}</pre>
        <button type="button" onClick={() => { window.location.replace(roleHome) }} className="w-full rounded-lg bg-blue-900 text-white py-3">I saved the recovery codes — Continue</button>
      </div>}
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      <button type="button" disabled={busy} onClick={() => void startAgain()} className="inline-block text-blue-700 text-sm underline disabled:opacity-60">Cancel and start staff sign-in again</button>
    </section>
  </main>
}
