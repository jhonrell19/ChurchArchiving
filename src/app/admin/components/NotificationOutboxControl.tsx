'use client'

import { useCallback, useEffect, useState } from 'react'

export default function NotificationOutboxControl() {
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(0)
  const [autoSend, setAutoSend] = useState(false)
  const [smsConfigured, setSmsConfigured] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/dispatch', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Outbox unavailable')
      setEnabled(!!data.enabled)
      setPending(Number(data.pending || 0))
      setAutoSend(data.autoSend === true)
      setSmsConfigured(data.smsConfigured === true)
      setEmailConfigured(data.emailConfigured === true)
    } catch { setNote('Notification outbox is not ready. Database migration may be missing.') }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  if (!enabled) return null
  const send = async () => {
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/admin/notifications/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not process notices.')
      setNote('Processed ' + (data.processed ?? 0) + ' event(s). ' +
        (data.acceptedChannels ?? 0) + ' provider acceptance(s); handset delivery is not confirmed.')
      await refresh()
    } catch (e) { setNote(e instanceof Error ? e.message : 'Unable to send updates.') }
    finally { setBusy(false) }
  }
  return (
    <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-emerald-950">SMS &amp; email notification queue</h3>
          <p className="mt-1 text-sm text-emerald-900">{pending} queued request update(s) for this office.</p>
          <p className="mt-1 text-sm font-medium text-emerald-950">
            {autoSend
              ? 'Automatic dispatch is on. Status, approved payment and release updates are queued after a successful server change.'
              : 'Automatic dispatch is off. Staff must send queued updates until Render is configured.'}
          </p>
          <p className="mt-1 text-xs text-emerald-900">
            textbee SMS: {smsConfigured ? 'configured' : 'not configured'} · Email: {emailConfigured ? 'configured' : 'not configured'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void refresh()}
            className="min-h-11 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900">
            Refresh queue
          </button>
          <button type="button" onClick={() => void send()} disabled={busy || pending === 0}
            className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Processing…' : 'Send queued updates'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-emerald-900">
        Only opted-in users with verified mobile numbers receive SMS.
        The textbee phone must be online with sufficient SIM allowance. Provider acceptance does not guarantee delivery.
        Users must opt in and verify their mobile number. A failed message never cancels a request or a payment.
      </p>
      {note && <p role="status" className="mt-2 text-sm text-emerald-950">{note}</p>}
    </section>
  )
}
