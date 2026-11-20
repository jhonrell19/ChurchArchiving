'use client'

import { useEffect, useState } from 'react'
import { inputCls, selectCls } from '../data/ui'

type Announcement = {
  id: number
  title: string
  category: string
  date: string
  body: string
  starts?: string
  ends?: string
  createdAt: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    title: '',
    category: 'Event',
    date: '',
    body: '', starts:'', ends:'', image:'', priority:'0',
  })

  const loadAnnouncements = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/announcements')

      if (!res.ok) {
        throw new Error('Failed to load announcements')
      }

      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (err) {
      console.warn('Load announcements error:', err)
      alert('Cannot load announcements. The parish backend service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadAnnouncements())
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const publishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim() || !form.body.trim()) {
      alert('Title and body are required.')
      return
    }

    try {
      const res = await fetch('/api/backend/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to publish announcement.')
        return
      }

      alert('Announcement published successfully.')

      setForm({
        title: '',
        category: 'Event',
        date: '',
        body: '', starts:'', ends:'', image:'', priority:'0',
      })

      await loadAnnouncements()
    } catch (err) {
      console.warn('Publish announcement error:', err)
      alert('Failed to publish announcement.')
    }
  }

  const deleteAnnouncement = async (id: number) => {
    if (!confirm('Delete this announcement?')) return

    try {
      const res = await fetch(`/api/backend/api/announcements/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to delete announcement.')
        return
      }

      await loadAnnouncements()
    } catch (err) {
      console.warn('Delete announcement error:', err)
      alert('Failed to delete announcement.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-navy-mid text-xl font-semibold">
          Announcements
        </h2>
      </div>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Create and manage parish announcements visible to all users.
      </p>

      <form
        onSubmit={publishAnnouncement}
        className="bg-white border border-gold/20 rounded-xl p-6 mb-6"
      >
        <p className="font-display text-navy-mid text-[13px] font-semibold mb-4">
          New Announcement
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label htmlFor="notice-title" className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Title *
            </label>
            <input
              id="notice-title" name="title"
              type="text"
              placeholder="Announcement title…"
              value={form.title}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="notice-category" className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Category
            </label>
            <select
              id="notice-category" name="category"
              value={form.category}
              onChange={handleChange}
              className={`${selectCls} w-full`}
            >
              {process.env.NEXT_PUBLIC_PARISH_ANNOUNCEMENT_SLIDES === 'enabled' && <option value="Public calendar notice">Public calendar notice (visible on homepage)</option>}
              <option value="Event">Event</option>
              <option value="Schedule">Schedule</option>
              <option value="Ministry">Ministry</option>
              <option value="Sacrament">Sacrament</option>
            </select>
          </div>

          <div>
            <label htmlFor="notice-date" className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Date
            </label>
            <input
              id="notice-date" name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notice-body" className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Body *
            </label>
            <textarea
              id="notice-body" name="body"
              rows={4}
              placeholder="Announcement body…"
              value={form.body}
              onChange={handleChange}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {process.env.NEXT_PUBLIC_PARISH_ANNOUNCEMENT_SLIDES==='enabled' && <div className="parish-filters">
          <label>Publish from<input type="date" required={form.category === "Public calendar notice"} name="starts" value={form.starts} onChange={handleChange}/></label>
          <label>Publish through<input type="date" min={form.starts} required={form.category === "Public calendar notice"} name="ends" value={form.ends} onChange={handleChange}/></label>
          <label>Priority<input type="number" min="-1000" max="1000" name="priority" value={form.priority} onChange={handleChange}/></label>
          <label>Parish image<select name="image" value={form.image} onChange={handleChange}><option value="">Text only</option>{['slide1.jpg','slide2.jpg','slide3.png','slide4.jpg'].map((img,i)=><option key={img} value={'/slides/'+img}>Parish photo {i+1}</option>)}</select></label></div>}
        <button className="font-display text-[11px] tracking-wider bg-navy text-gold px-5 py-2.5 rounded-lg">
          Publish Announcement
        </button>
      </form>

      <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
        <div className="border-b border-gold/10 bg-gold/5 px-5 py-3">
          <p className="font-display text-[11px] tracking-wider text-navy-mid font-semibold">
            Published Announcements
          </p>
        </div>

        {loading ? (
          <p className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
            Loading announcements...
          </p>
        ) : announcements.length === 0 ? (
          <p className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
            No announcements published yet.
          </p>
        ) : (
          <div className="divide-y divide-gold/10">
            {announcements.map(a => (
              <div key={a.id} className="p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-display text-navy-mid text-[13px] font-semibold">
                      {a.title}
                    </p>

                    <span className="font-display text-[10px] tracking-wider border border-gold/25 text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                      {a.category || 'General'}
                    </span>
                  </div>

                  <p className="font-body text-[#9ab0c4] text-[11px] mb-2">
                    {a.date || a.createdAt?.slice(0, 10) || 'No event date'}{a.starts && ' · Publish from ' + a.starts}{a.ends && ' through ' + a.ends}
                  </p>

                  <p className="font-body text-[#4a6a8a] text-[13px] leading-relaxed">
                    {a.body}
                  </p>
                </div>

                <button
                  aria-label={'Delete announcement: '+a.title}
                  onClick={() => deleteAnnouncement(a.id)}
                  className="p-1.5 rounded-lg border border-red-200 text-red-600"
                >
                  <i className="ti ti-trash text-[14px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}