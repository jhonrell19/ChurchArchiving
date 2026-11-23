'use client'

import { useFeedback } from '@/components/ui/FeedbackProvider'

import { useEffect, useState } from 'react'
import MassMediaPlayer from '../../components/MassMediaPlayer'
import { STATUS_STYLE, inputCls, selectCls } from '../data/ui'

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

export default function MassesPage({ initialTranscript }: { initialTranscript: number | null }) {
  const { toast, confirmAction } = useFeedback()
  const [playing, setPlaying] = useState<{ title: string; filepath: string } | null>(null)
  const [masses, setMasses] = useState<MassRecord[]>([])
  const [filterStatus, setFilter] = useState<'All' | MassStatus>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(initialTranscript)

  const [form, setForm] = useState({
    title: '',
    priest: '',
    category: 'High Mass',
    date: '',
    duration: '',
    status: 'Pending' as MassStatus,
  })

  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')

  const [transcriptionForm, setTranscriptionForm] = useState<Record<number, {
    transcriptText: string
    summaryText: string
  }>>({})

  const [cloudRecording, setCloudRecording] = useState<Record<number, File | null>>({})
  const [cloudAuthorized, setCloudAuthorized] = useState<Record<number, boolean>>({})
  const [cloudBusy, setCloudBusy] = useState<number | null>(null)

  const transcribeInWebsite = async (massId: number) => {
    const recording = cloudRecording[massId]
    if (!recording) {
      toast.warning('Select a recorded Mass audio or video file.')
      return
    }
    if (recording.size > 23 * 1024 * 1024) {
      toast.warning('First release supports files smaller than 23 MB. Larger Masses need chunked processing.')
      return
    }
    if (!cloudAuthorized[massId]) {
      toast.warning('Confirm that the parish is authorized to send this recording to the external AI provider.')
      return
    }
    if (cloudBusy !== null) return
    setCloudBusy(massId)
    try {
      const body = new FormData()
      body.append('recording', recording)
      body.append('authorized', 'yes')
      const response = await fetch('/api/admin/masses/' + massId + '/transcribe', {
        method: 'POST', body, cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(result.error || 'Cloud transcription failed.')
        return
      }
      if (typeof result.transcriptText !== 'string' || !result.transcriptText.trim()) {
        toast.error('No transcription was returned.')
        return
      }
      setTranscriptionForm(prev => ({
        ...prev,
        [massId]: {
          transcriptText: result.transcriptText,
          summaryText: typeof result.summaryText === 'string' && result.summaryText.trim()
            ? result.summaryText : '',
        },
      }))
      if (result.summaryGenerated) {
        toast.success('Cloud transcript and AI summary prepared. Review both before saving.')
      } else {
        toast.warning('Cloud transcript prepared. Enter your summary before saving.')
      }
    } catch {
      toast.error('Could not reach the cloud transcription service.')
    } finally {
      setCloudBusy(null)
    }
  }

  const loadMasses = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/masses')

      if (!res.ok) {
        throw new Error('Failed to load masses')
      }

      const data = await res.json()
      setMasses(data.masses || [])
    } catch (err) {
      console.warn('Load masses error:', err)
      toast.error('Cannot load mass records. The parish backend service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadMasses())
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
      toast.error('Mass title is required.')
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

      if (file && videoUrl.trim()) {
        toast.warning('Choose a YouTube link OR a file, not both.')
        return
      }
      if (videoUrl.trim()) formData.append('videoUrl', videoUrl.trim())
      if (file) formData.append('file', file)

      const res = await fetch('/api/backend/api/masses', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create mass record.')
        return
      }

      toast.success('Mass record added successfully.')

      setForm({
        title: '',
        priest: '',
        category: 'High Mass',
        date: '',
        duration: '',
        status: 'Pending',
      })

      setFile(null)
      setVideoUrl('')
      setShowForm(false)
      await loadMasses()
    } catch (err) {
      console.warn('Create mass error:', err)
      toast.error('Failed to create mass record.')
    }
  }

  const updateStatus = async (id: number, status: MassStatus) => {
    try {
      const res = await fetch(`/api/backend/api/masses/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to update status.')
        return
      }

      await loadMasses()
    } catch (err) {
      console.warn('Update mass status error:', err)
      toast.error('Failed to update mass status.')
    }
  }

  const saveTranscription = async (id: number) => {
    const values = transcriptionForm[id]

    if (!values?.transcriptText?.trim() && !values?.summaryText?.trim()) {
      toast.warning('Please enter transcript or summary text.')
      return
    }

    try {
      const res = await fetch(`/api/backend/api/masses/${id}/transcription`, {
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
        toast.error(data.error || 'Failed to save transcription.')
        return
      }

      toast.success('Transcription and summary saved.')
      await loadMasses()
    } catch (err) {
      console.warn('Save transcription error:', err)
      toast.error('Failed to save transcription.')
    }
  }

  const deleteMass = async (id: number) => {
    if (!await confirmAction('Delete this mass record?')) return

    try {
      const res = await fetch(`/api/backend/api/masses/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete mass record.')
        return
      }

      await loadMasses()
    } catch (err) {
      console.warn('Delete mass error:', err)
      toast.error('Failed to delete mass record.')
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
      {playing && <MassMediaPlayer title={playing.title} filepath={playing.filepath} onClose={() => setPlaying(null)} />}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-emerald-950 text-xl font-semibold">
          Mass Recordings
        </h2>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 font-display text-sm tracking-wider bg-emerald-900 text-white px-4 py-2 rounded-lg"
        >
          <i className="ti ti-upload text-base" />
          {showForm ? 'Close Form' : 'Upload Mass'}
        </button>
      </div>

      <p className="font-body text-slate-700 text-[14px] mb-6">
        Manage Mass video links and locally reviewed transcription drafts.
      </p>

      <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
        Original-language AI transcription: preserve exactly the speech recognized in Tagalog, English, or both;
        never translate the homily into English. Choose <strong>Prepare transcript</strong>, run the local assistant,
        review the generated full transcript against the audio, then save. The summary is separate and editable.
      </p>
      {showForm && (
        <form
          onSubmit={handleCreateMass}
          className="bg-white border border-emerald-200 rounded-xl p-5 mb-6"
        >
          <p className="font-display text-emerald-950 text-base font-semibold mb-4">
            Add Mass Record
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
                {/* Full transcription is assigned only after staff saves actual speech text. */}
              </select>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="mass-video-url" className="mb-1 block text-sm font-semibold text-emerald-950">
                YouTube Mass video link (recommended for Render Free)
              </label>
              <input id="mass-video-url" type="url" value={videoUrl}
                onChange={event => setVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
                className="w-full rounded-lg border border-emerald-300 bg-white p-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" />
              <p className="mt-1 text-sm text-slate-600">
                Store an unlisted YouTube video link. Upload the original recording separately to the parish backup drive for transcription.
              </p>
            </div>
            <div className="md:col-span-3">
              <label className="block font-display text-sm tracking-wider text-emerald-950 mb-1">
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
            <button className="font-display text-sm tracking-wider bg-emerald-900 text-white px-4 py-2 rounded-lg">
              Save Mass Record
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="font-display text-sm tracking-wider text-slate-700 border border-emerald-200 px-4 py-2 rounded-lg"
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
            className={`font-display text-sm tracking-wider px-4 py-1.5 rounded-full border transition-all ${
              filterStatus === s
                ? 'bg-emerald-900 text-white border-navy'
                : 'bg-white text-emerald-950 border-emerald-200'
            }`}
          >
            {s}
            <span className="ml-1 text-xs">
              {s === 'All'
                ? masses.length
                : masses.filter(m => m.status === s).length}
            </span>
          </button>
        ))}

        <div className="relative ml-auto">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[14px]" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-emerald-200 rounded-full font-body text-base text-emerald-950 bg-white focus:outline-none w-48"
          />
        </div>
      </div>

      <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-emerald-100 bg-emerald-50">
              <th className="font-display text-xs tracking-widest uppercase text-slate-600 text-left px-5 py-3">
                Mass Title
              </th>
              <th className="font-display text-xs tracking-widest uppercase text-slate-600 text-left px-5 py-3 hidden md:table-cell">
                Date
              </th>
              <th className="font-display text-xs tracking-widest uppercase text-slate-600 text-left px-5 py-3 hidden lg:table-cell">
                Priest
              </th>
              <th className="font-display text-xs tracking-widest uppercase text-slate-600 text-left px-5 py-3">
                Status
              </th>
              <th className="font-display text-xs tracking-widest uppercase text-slate-600 text-left px-5 py-3">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="font-body text-slate-600 text-base text-center py-10">
                  Loading mass records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="font-body text-slate-600 text-base text-center py-10">
                  No mass records found.
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id} className="border-b border-emerald-100 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-display text-emerald-950 text-base font-semibold">
                      {m.title}
                    </p>
                    <p className="font-body text-slate-600 text-sm">
                      {m.category || 'No category'} · {m.duration || 'No duration'}
                    </p>
                  </td>

                  <td className="px-5 py-3 font-body text-slate-700 text-sm hidden md:table-cell">
                    {m.date || 'No date'}
                  </td>

                  <td className="px-5 py-3 font-body text-slate-700 text-sm hidden lg:table-cell">
                    {m.priest || 'N/A'}
                  </td>

                  <td className="px-5 py-3">
                    <span className={`font-display text-xs tracking-wider border px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[m.status] || 'bg-white text-slate-600 border-emerald-200'
                    }`}>
                      {m.status}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {m.status === 'Pending' && (
                        <button
                          onClick={() => updateStatus(m.id, 'In Progress')}
                          className="font-display text-xs tracking-wider text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-50"
                        >
                          Start review
                        </button>
                      )}

                      <button type="button" aria-expanded={expanded === m.id}
                        className="parish-report-link" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                        {expanded === m.id ? 'Close transcript' : 'Prepare transcript'}
                      </button>

                      {m.filepath && (
                        <button type="button" onClick={() => setPlaying({ title: m.title, filepath: m.filepath! })}
                          aria-label={`Play ${m.title}`}
                          className="p-1.5 rounded-lg border border-emerald-200 text-slate-700"
                        >
                          <i className="ti ti-player-play text-[14px]" />
                        </button>
                      )}

                      <button
                        onClick={() => deleteMass(m.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600"
                      >
                        <i className="ti ti-trash text-[14px]" />
                      </button>
                    </div>

                    {expanded === m.id && (
                      <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <div className="rounded-xl border border-emerald-300 bg-white p-4 space-y-3">
                          <h3 className="text-lg font-semibold text-emerald-950">Transcribe directly in Smart Parish</h3>
                          <p className="text-sm text-slate-700">
                            Upload a recording and create a <strong>review-only draft</strong> using hosted multilingual Whisper.
                            The site does not run Whisper itself, and you do not need to install Python.
                            Tagalog and English are transcribed in their recognized spoken language; review errors before publishing.
                          </p>
                          <label className="block text-sm font-semibold text-slate-800">
                            Mass recording (up to 23 MB)
                            <input
                              type="file"
                              accept=".mp3,.m4a,.wav,.mp4,.flac,.ogg,.webm,.mpeg,.mpga,audio/*,video/mp4"
                              className="mt-2 block w-full text-base"
                              disabled={cloudBusy !== null}
                              onChange={event => setCloudRecording(prev => ({
                                ...prev,
                                [m.id]: event.target.files?.[0] ?? null,
                              }))}
                            />
                          </label>
                          <label className="flex items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={cloudAuthorized[m.id] || false}
                              disabled={cloudBusy !== null}
                              onChange={event => setCloudAuthorized(prev => ({ ...prev, [m.id]: event.target.checked }))}
                            />
                            <span>I confirm the parish is authorized to send this recording to an external AI provider for transcription and summarization.</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <button type="button"
                              disabled={cloudBusy !== null || !cloudRecording[m.id] || !cloudAuthorized[m.id]}
                              onClick={() => void transcribeInWebsite(m.id)}
                              className="min-h-11 rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
                              {cloudBusy === m.id ? 'Transcribing in the cloud…' : 'Transcribe Mass in Website'}
                            </button>
                            <span className="text-xs text-slate-600">
                              First release: keep this page open while processing. Long recordings need the next queued/chunked upgrade.
                            </span>
                          </div>
                        </div>
                        <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                            Optional: import an existing transcript JSON draft
                          </summary>
                        <label className="my-4 block font-semibold">Import local transcription draft
                          <input type="file" accept=".json,application/json" className="block" onChange={async event=>{
                            const file=event.target.files?.[0]; event.target.value=''
                            if (!file) return
                            try {
                              if (file.size>2500000) throw Error()
                              const draft=JSON.parse(await file.text())
                              if (typeof draft.transcriptText!=='string' || !draft.transcriptText.trim() || draft.transcriptText.length>500000 || typeof draft.summaryText!=='string' || draft.summaryText.length>50000) throw Error()
                              setTranscriptionForm(prev=>({...prev,[m.id]:{transcriptText:draft.transcriptText, summaryText:draft.summaryText}}))
                            } catch { toast.warning('Choose a valid local transcript JSON draft.') }
                          }}/>
                        </label>
                        </details>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block font-display text-xs tracking-widest uppercase text-slate-600 mb-1">
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
                            <label className="block font-display text-xs tracking-widest uppercase text-slate-600 mb-1">
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
                            className="font-display text-sm tracking-wider bg-emerald-900 text-white px-4 py-2 rounded-lg"
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