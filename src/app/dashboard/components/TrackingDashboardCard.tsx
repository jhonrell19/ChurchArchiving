'use client'

import { useCallback, useEffect, useState } from 'react'
import RequestTracking, { type TrackingRequest } from '@/components/RequestTracking'

export default function TrackingDashboardCard({ onOpen }: { onOpen: () => void }) {
  const [request, setRequest] = useState<TrackingRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/backend/api/requests?page=1', {
        cache: 'no-store', signal,
      })
      if (!response.ok) throw new Error('Could not load request tracking')
      const data: { requests?: TrackingRequest[] } = await response.json()
      if (signal?.aborted) return
      setRequest(Array.isArray(data.requests) ? data.requests[0] ?? null : null)
    } catch {
      if (!signal?.aborted) setError(true)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  return (
    <section className="mb-6 mt-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Latest document request status">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Track my document request</h2>
          <p className="mt-1 text-sm text-slate-600">Follow real request and payment updates, even without an SMS gateway.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void reload()} disabled={loading}
            className="min-h-11 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">
            {loading ? 'Updating…' : 'Refresh status'}
          </button>
          <button type="button" onClick={onOpen}
            className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900">
            All requests
          </button>
        </div>
      </div>
      {loading && !request ? <p className="text-sm text-slate-600">Retrieving your most recent request…</p>
        : error ? <p role="alert" className="text-sm text-amber-900">Tracking is temporarily unavailable. Use Refresh status to try again.</p>
        : request ? <RequestTracking request={request} compact />
          : <p className="text-sm text-slate-700">No certificate requests on your account yet. Choose All requests to create one.</p>}
    </section>
  )
}
