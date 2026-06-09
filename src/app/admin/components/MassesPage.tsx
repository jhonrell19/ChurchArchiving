'use client'

import { useEffect, useState } from 'react'
import { STATUS_STYLE, inputCls, selectCls } from '../data/mockData'

type MassStatus = 'Pending' | 'In Progress' | 'Transcribed'

type MassRecord = {
  id: number
  title: string
  priest: string
  category: string
  date: string
  duration: string
  status: MassStatus
  filename: string | null
  filepath: string | null
  transcriptText: string | null
  summaryText: string | null
  hasTranscript: boolean
}

export default function MassesPage() {
  const [masses, setMasses] = useState<MassRecord[]>([])
  const [filterStatus, setFilter] = useState<'All' | MassStatus>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [transcribingId, setTranscribingId] = useState<number | null>(null)

  const [form, setForm] = useState({
    title: '',
    priest: '',
    category: 'High Mass',
    date: '',
    duration: '',
    status: 'Pending' as MassStatus,
  })

  const [file, setFile] = useState<File | null>(null)

  const [transcriptionForm, setTranscriptionForm] = useState<Record<number, {
    transcriptText: string
    summaryText: string
  }>>({})

  const loadMasses = async () => {
    try {
      setLoading(true)

      const res = await fetch('http://127.0.0.1:5000/api/masses')

      if (!res.ok) {
        throw new Error('Failed to load masses')
      }

      const data = await res.json()
      setMasses(data.masses || [])
    } catch (err) {
      console.error('Load masses error:', err)
      alert('Cannot load mass records. Make sure Flask is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMasses()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleCreateMass = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      alert('Mass title is required.')
      return
    }

    try {
      const formData = new FormData()

      formData.append('title', form.title)
      formData.append('priest', form.priest)
      formData.append('category', form.category)
      formData.append('date', form.date)
      formData.append('duration', form.duration)
      formData.append('status', form.status)

      if (file) {
        formData.append('file', file)
      }

      const res = await fetch('http://127.0.0.1:5000/api/masses', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to create mass record.')
        return
      }

      alert('Mass record added successfully.')

      setForm({
        title: '',
        priest: '',
        category: 'High Mass',
        date: '',
        duration: '',
        status: 'Pending',
      })

      setFile(null)
      setShowForm(false)
      await loadMasses()
    } catch (err) {
      console.error('Create mass error:', err)
      alert('Failed to create mass record.')
    }
  }

  const updateStatus = async (id: number, status: MassStatus) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/masses/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to update status.')
        return
      }

      await loadMasses()
    } catch (err) {
      console.error('Update mass status error:', err)
      alert('Failed to update mass status.')
    }
  }

  const saveTranscription = async (id: number) => {
    const values = transcriptionForm[id]

    if (!values?.transcriptText?.trim() && !values?.summaryText?.trim()) {
      alert('Please enter transcript or summary text.')
      return
    }

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/masses/${id}/transcription`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptText: values.transcriptText,
          summaryText: values.summaryText,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to save transcription.')
        return
      }

      alert('Transcription and summary saved.')
      await loadMasses()
    } catch (err) {
      console.error('Save transcription error:', err)
      alert('Failed to save transcription.')
    }
  }

  const runAITranscription = async (id: number) => {
    if (!confirm('Start AI transcription? This may take several minutes.')) return

    try {
      setTranscribingId(id)

      const res = await fetch(`http://127.0.0.1:5000/api/masses/${id}/transcribe-ai`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'AI transcription failed.')
        return
      }

      alert('AI transcription completed successfully.')
      await loadMasses()
      setExpanded(id)
    } catch (err) {
      console.error('AI transcription error:', err)
      alert('AI transcription failed. Make sure Flask, FFmpeg, and Faster Whisper are working.')
    } finally {
      setTranscribingId(null)
    }
  }

  const deleteMass = async (id: number) => {
    if (!confirm('Delete this mass record?')) return

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/masses/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to delete mass record.')
        return
      }

      await loadMasses()
    } catch (err) {
      console.error('Delete mass error:', err)
      alert('Failed to delete mass record.')
    }
  }

  const filtered = masses.filter(m =>
    (filterStatus === 'All' || m.status === filterStatus) &&
    (
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.priest?.toLowerCase().includes(search.toLowerCase()) ||
      m.category?.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-navy-mid text-xl font-semibold">
          Mass Recordings
        </h2>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg"
        >
          <i className="ti ti-upload text-[13px]" />
          {showForm ? 'Close Form' : 'Upload Mass'}
        </button>
      </div>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Manage uploaded masses and assign transcription status.
      </p>

      {showForm && (
        <form
          onSubmit={handleCreateMass}
          className="bg-white border border-gold/20 rounded-xl p-5 mb-6"
        >
          <p className="font-display text-navy-mid text-[13px] font-semibold mb-4">
            Add Mass Record
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Mass Title *
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Sunday High Mass"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Priest
              </label>
              <input
                name="priest"
                value={form.priest}
                onChange={handleChange}
                placeholder="Fr. Name"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className={`${selectCls} w-full`}
              >
                <option value="High Mass">High Mass</option>
                <option value="Morning Mass">Morning Mass</option>
                <option value="Special Mass">Special Mass</option>
                <option value="Bible Study">Bible Study</option>
                <option value="Prayer Service">Prayer Service</option>
              </select>
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Mass Date
              </label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Duration
              </label>
              <input
                name="duration"
                value={form.duration}
                onChange={handleChange}
                placeholder="1h 20m"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className={`${selectCls} w-full`}
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Transcribed">Transcribed</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block font-display text-[11px] tracking-wider text-navy-mid mb-1">
                Upload Video/Audio File
              </label>
              <input
                type="file"
                accept=".mp4,.mp3,.wav,.m4a,.mov"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button className="font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg">
              Save Mass Record
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/20 px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {(['All', 'Pending', 'In Progress', 'Transcribed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`font-display text-[11px] tracking-wider px-4 py-1.5 rounded-full border transition-all ${
              filterStatus === s
                ? 'bg-navy text-gold border-navy'
                : 'bg-white text-navy-mid border-gold/20'
            }`}
          >
            {s}
            <span className="ml-1 text-[10px]">
              {s === 'All'
                ? masses.length
                : masses.filter(m => m.status === s).length}
            </span>
          </button>
        ))}

        <div className="relative ml-auto">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c4] text-[14px]" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-gold/20 rounded-full font-body text-[13px] text-navy-mid bg-white focus:outline-none w-48"
          />
        </div>
      </div>

      <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold/10 bg-gold/5">
              <th className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3">
                Mass Title
              </th>
              <th className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3 hidden md:table-cell">
                Date
              </th>
              <th className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3 hidden lg:table-cell">
                Priest
              </th>
              <th className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3">
                Status
              </th>
              <th className="font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] text-left px-5 py-3">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  Loading mass records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="font-body text-[#9ab0c4] text-[13px] text-center py-10">
                  No mass records found.
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id} className="border-b border-gold/10 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-display text-navy-mid text-[13px] font-semibold">
                      {m.title}
                    </p>
                    <p className="font-body text-[#9ab0c4] text-[11px]">
                      {m.category || 'No category'} · {m.duration || 'No duration'}
                    </p>
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px] hidden md:table-cell">
                    {m.date || 'No date'}
                  </td>

                  <td className="px-5 py-3 font-body text-[#6b8caa] text-[12px] hidden lg:table-cell">
                    {m.priest || 'N/A'}
                  </td>

                  <td className="px-5 py-3">
                    <span className={`font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[m.status] || 'bg-white text-[#9ab0c4] border-gold/20'
                    }`}>
                      {m.status}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {m.status !== 'Transcribed' && (
                        <button
                          onClick={() =>
                            updateStatus(
                              m.id,
                              m.status === 'Pending' ? 'In Progress' : 'Transcribed'
                            )
                          }
                          className="font-display text-[10px] tracking-wider text-gold border border-gold/30 px-2.5 py-1 rounded-lg bg-gold/5"
                        >
                          {m.status === 'Pending' ? 'Start' : 'Mark Done'}
                        </button>
                      )}

                      {m.filepath && (
                        <button
                          onClick={() => runAITranscription(m.id)}
                          disabled={transcribingId === m.id}
                          className="font-display text-[10px] tracking-wider text-gold border border-gold/30 px-2.5 py-1 rounded-lg bg-gold/5 disabled:opacity-50"
                        >
                          {transcribingId === m.id ? 'Transcribing...' : 'AI Transcribe'}
                        </button>
                      )}

                      <button
                        onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg border border-gold/20 text-gold"
                        aria-label="View"
                      >
                        <i className={`ti ${expanded === m.id ? 'ti-chevron-up' : 'ti-eye'} text-[14px]`} />
                      </button>

                      {m.filepath && (
                        <a
                          href={`http://127.0.0.1:5000/files/${m.filepath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-gold/20 text-[#6b8caa]"
                        >
                          <i className="ti ti-player-play text-[14px]" />
                        </a>
                      )}

                      <button
                        onClick={() => deleteMass(m.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600"
                      >
                        <i className="ti ti-trash text-[14px]" />
                      </button>
                    </div>

                    {expanded === m.id && (
                      <div className="mt-4 bg-gold/5 border border-gold/10 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                              Summary
                            </label>
                            <textarea
                              rows={4}
                              value={transcriptionForm[m.id]?.summaryText ?? m.summaryText ?? ''}
                              onChange={e =>
                                setTranscriptionForm(prev => ({
                                  ...prev,
                                  [m.id]: {
                                    transcriptText: prev[m.id]?.transcriptText ?? m.transcriptText ?? '',
                                    summaryText: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Enter sermon summary..."
                              className={`${inputCls} resize-none`}
                            />
                          </div>

                          <div>
                            <label className="block font-display text-[10px] tracking-widest uppercase text-[#9ab0c4] mb-1">
                              Full Transcript
                            </label>
                            <textarea
                              rows={4}
                              value={transcriptionForm[m.id]?.transcriptText ?? m.transcriptText ?? ''}
                              onChange={e =>
                                setTranscriptionForm(prev => ({
                                  ...prev,
                                  [m.id]: {
                                    transcriptText: e.target.value,
                                    summaryText: prev[m.id]?.summaryText ?? m.summaryText ?? '',
                                  },
                                }))
                              }
                              placeholder="Enter full transcript..."
                              className={`${inputCls} resize-none`}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => saveTranscription(m.id)}
                            className="font-display text-[11px] tracking-wider bg-navy text-gold px-4 py-2 rounded-lg"
                          >
                            Save Transcription & Summary
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}