'use client'

import { useEffect, useState } from 'react'
import { inputCls, selectCls } from '../data/mockData'

type Announcement = {
  id: number
  title: string
  category: string
  date: string
  body: string
  createdAt: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    title: '',
    category: 'Event',
    date: '',
    body: '',
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
      console.error('Load announcements error:', err)
      alert('Cannot load announcements. The parish backend service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
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
        body: '',
      })

      await loadAnnouncements()
    } catch (err) {
      console.error('Publish announcement error:', err)
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
      console.error('Delete announcement error:', err)
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
            <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Title *
            </label>
            <input
              name="title"
              type="text"
              placeholder="Announcement title…"
              value={form.title}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Category
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className={`${selectCls} w-full`}
            >
              <option value="Event">Event</option>
              <option value="Schedule">Schedule</option>
              <option value="Ministry">Ministry</option>
              <option value="Sacrament">Sacrament</option>
            </select>
          </div>

          <div>
            <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Date
            </label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1.5">
              Body *
            </label>
            <textarea
              name="body"
              rows={4}
              placeholder="Announcement body…"
              value={form.body}
              onChange={handleChange}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

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
                    {a.date || a.createdAt?.slice(0, 10) || 'No date'}
                  </p>

                  <p className="font-body text-[#4a6a8a] text-[13px] leading-relaxed">
                    {a.body}
                  </p>
                </div>

                <button
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