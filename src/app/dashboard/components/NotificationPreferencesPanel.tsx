'use client'

import { useCallback, useEffect, useState } from 'react'

type Preferences = {
  enabled: boolean
  smsUpdates: boolean
  emailUpdates: boolean
  announcementEmail: boolean
  announcementSms: boolean
  phoneVerified: boolean
  phoneEnding: string
}

export default function NotificationPreferencesPanel() {
  const [value, setValue] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Settings unavailable.')
      setValue(data.enabled ? data as Preferences : null)
    } catch { setStatus('Notification preferences are temporarily unavailable.') }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!value) return null

  const save = async () => {
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsUpdates: value.smsUpdates, emailUpdates: value.emailUpdates,
          announcementEmail: value.announcementEmail, announcementSms: value.announcementSms }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Unable to save settings.')
      setStatus('Your notification preferences are saved.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Unable to save settings.')
    } finally { setSaving(false) }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Request &amp; payment alerts</h3>
      <p className="mt-2 text-sm text-slate-700">
        Choose how the parish contacts you when your document request or verified payment status changes.
        Tracking in My Requests is always available even if alerts are switched off.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm text-slate-800">
        <input type="checkbox" checked={value.emailUpdates}
          onChange={e => setValue(v => v ? { ...v, emailUpdates: e.target.checked } : v)}
          className="mt-1 h-4 w-4" />
        <span>Email me request and payment status updates.</span>
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm text-slate-800">
        <input type="checkbox" checked={value.smsUpdates}
          disabled={!value.phoneVerified}
          onChange={e => setValue(v => v ? { ...v, smsUpdates: e.target.checked } : v)}
          className="mt-1 h-4 w-4" />
        <span>Text me request and payment updates at my verified number ending in {value.phoneEnding || '—'}.</span>
      </label>
      {!value.phoneVerified && <p className="mt-2 text-sm text-amber-800">
        Verify your saved phone number above before enabling SMS notices.
      </p>}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h4 className="text-base font-bold text-slate-900">Optional parish announcements</h4>
        <p className="mt-1 text-sm text-slate-600">Choose whether to receive new parish event and Homily schedule notices. Both are off until you opt in.</p>
        <label className="mt-3 flex items-start gap-3 text-base text-slate-800">
          <input type="checkbox" checked={value.announcementEmail}
            onChange={e=>setValue(v=>v?{...v,announcementEmail:e.target.checked}:v)} className="mt-1 h-5 w-5"/>
          <span>Email me new parish announcements.</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-base text-slate-800">
          <input type="checkbox" checked={value.announcementSms} disabled={!value.phoneVerified}
            onChange={e=>setValue(v=>v?{...v,announcementSms:e.target.checked}:v)} className="mt-1 h-5 w-5"/>
          <span>Text me new announcements (verified phone required).</span>
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Standard carrier SMS charges may apply. You may disable updates here at any time.
        These are transactional notices, not marketing messages.
      </p>
      <button type="button" onClick={() => void save()} disabled={saving}
        className="mt-4 min-h-12 rounded-lg bg-navy px-5 py-2 text-base font-semibold text-white disabled:opacity-50">
        {saving ? 'Saving…' : 'Save alert preferences'}
      </button>
      {status && <p role="status" className="mt-3 text-sm text-slate-700">{status}</p>}
    </section>
  )
}
