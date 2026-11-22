'use client'

import { useCallback, useEffect, useState } from 'react'

type Notice = {
  id: number
  message: string
  kind: string
  createdAt: string
  smsState: string
  emailState: string
}

export default function StatusNotificationInbox() {
  const [events, setEvents] = useState<Notice[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) throw new Error('Unavailable')
      const data = await res.json()
      setEnabled(!!data.enabled)
      setEvents(Array.isArray(data.events) ? data.events : [])
      setError(false)
    } catch { setError(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  if (!enabled && !error) return null
  const format = (iso: string) => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
  return (
    <section aria-label="Parish status messages" className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent parish notifications</h2>
          <p className="mt-1 text-sm text-slate-600">Updates from your authenticated request records.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load()}
          className="min-h-11 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">
          Refresh notifications
        </button>
      </div>
      {error && <p role="status" className="mt-4 text-sm text-amber-800">Notices are temporarily unavailable.</p>}
      {!error && !loading && events.length === 0 &&
        <p className="mt-4 text-sm text-slate-700">No request updates recorded yet.</p>}
      <ul className="mt-3 space-y-3">
        {events.map(event => (
          <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-900">{event.message}</p>
            <p className="mt-2 text-xs text-slate-500">{format(event.createdAt)}</p>
            <p className="mt-1 text-xs text-slate-600">
              SMS: {event.smsState === 'accepted' ? 'Gateway accepted (delivery unconfirmed)' : event.smsState}
              {' · '}Email: {event.emailState === 'accepted' ? 'Provider accepted' : event.emailState}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
