'use client'

import { useEffect, useState } from 'react'
type Notice = { id: number; title: string; body: string; date?: string; starts?: string }

export default function ParishNoticesPreview() {
  const [items, setItems] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/parish-calendar', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Notices unavailable')
        return response.json()
      })
      .then(data => {
        if (!controller.signal.aborted) setItems(Array.isArray(data.notices) ? data.notices : [])
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  const displayed = [...items].sort((a,b) => (b.date || b.starts || '').localeCompare(a.date || a.starts || '')).slice(0,3)
  return <section id="parish-notices" className="portal-notices" aria-labelledby="portal-notices-heading">
    <div className="portal-section-heading">
      <div><p className="portal-eyebrow">Stay informed</p><h2 id="portal-notices-heading">Parish announcements</h2></div>
      <a href="#parish-calendar" className="portal-secondary-btn">View parish calendar</a>
    </div>
    {loading ? <p role="status">Loading public notices…</p>
      : error ? <p>Public notices could not be loaded. Please check the calendar or contact the parish office.</p>
      : displayed.length ? <div className="portal-notice-list">{displayed.map(notice => <article key={notice.id}>
        <small>{notice.date || notice.starts || 'Parish notice'}</small>
        <h3>{notice.title}</h3>
        <p>{notice.body}</p>
      </article>)}</div>
        : <p>No public calendar notices have been posted yet. Check the calendar for regular Mass schedules and parish events.</p>}
  </section>
}
