'use client'

import { useEffect, useMemo, useState } from 'react'
import { inputCls } from '../data/ui'
import MassMediaPlayer from '../../components/MassMediaPlayer'

type MassRecord = {
  id: number
  title: string
  priest: string
  category: string
  date: string
  duration: string
  status: string
  filename: string | null
  filepath: string | null
  transcriptText: string | null
  summaryText: string | null
  hasTranscript: boolean
}

export default function ArchivesPage() {
  const [playing, setPlaying] = useState<{ title: string; filepath: string } | null>(null)
  const [search, setSearch] = useState('')
  const [priest, setPriest] = useState('All Priests')
  const [category, setCategory] = useState('All Categories')
  const [masses, setMasses] = useState<MassRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadMasses = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/masses')

      if (!res.ok) {
        throw new Error('Failed to load mass archives')
      }

      const data = await res.json()
      setMasses(data.masses || [])
    } catch (err) {
      console.warn('Mass archive load error:', err)
      setMasses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadMasses())
  }, [])

  const priests = useMemo(() => {
    const uniquePriests = Array.from(
      new Set(
        masses
          .map(m => m.priest)
          .filter(Boolean)
      )
    )

    return ['All Priests', ...uniquePriests]
  }, [masses])

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        masses
          .map(m => m.category)
          .filter(Boolean)
      )
    )

    return ['All Categories', ...uniqueCategories]
  }, [masses])

  const filtered = masses.filter(m =>
    (priest === 'All Priests' || m.priest === priest) &&
    (category === 'All Categories' || m.category === category) &&
    (
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.priest?.toLowerCase().includes(search.toLowerCase()) ||
      m.category?.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div>
      {playing && <MassMediaPlayer title={playing.title} filepath={playing.filepath} onClose={() => setPlaying(null)} />}
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Mass Archives
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        Browse and watch all archived masses and church services uploaded by the parish admin.
      </p>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <i
            className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c4] text-[16px]"
            aria-hidden="true"
          />

          <input
            type="text"
            placeholder="Search by title, priest, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-9 pr-4 py-2.5 ${inputCls}`}
          />
        </div>

        <select
          value={priest}
          onChange={e => setPriest(e.target.value)}
          className="border border-gold/20 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none"
        >
          {priests.map(p => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="border border-gold/20 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none"
        >
          {categories.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <p className="font-body text-[#9ab0c4] text-[14px]">
            Loading mass archives...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <i className="ti ti-video-off text-gold/30 text-5xl mb-3 block" />
          <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
            No mass archives found
          </p>
          <p className="font-body text-[#9ab0c4] text-[13px]">
            Mass recordings will appear here after the admin uploads them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(m => (
            <div
              key={m.id}
              className="bg-white border border-gold/20 rounded-xl overflow-hidden"
            >
              <div className="h-32 bg-navy flex items-center justify-center relative">
                {m.filepath ? <button type="button" aria-label={`Play ${m.title}`} onClick={() => setPlaying({ title: m.title, filepath: m.filepath! })} className="text-gold"><i className="ti ti-player-play text-3xl" /></button> : <i className="ti ti-video-off text-gold text-3xl" />}

                {m.hasTranscript && (
                  <span className="absolute top-3 right-3 font-display text-[10px] tracking-wider bg-gold text-navy px-2 py-1 rounded-full">
                    AI Transcript
                  </span>
                )}

                <span className="absolute bottom-3 right-3 font-body text-[10px] text-gold/70">
                  {m.duration || 'No duration'}
                </span>
              </div>

              <div className="p-4">
                <p className="font-display text-navy-mid text-[13px] font-semibold mb-1">
                  {m.title}
                </p>

                <p className="font-body text-[#6b8caa] text-[12px] mb-3">
                  {m.priest || 'No priest assigned'}
                </p>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-display text-[10px] tracking-wider border border-gold/25 text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                    {m.category || 'General'}
                  </span>

                  <span className="font-body text-[11px] text-[#9ab0c4]">
                    {m.date || 'No date'}
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {m.filepath ? (
                    <button type="button" onClick={() => setPlaying({ title: m.title, filepath: m.filepath! })}
                      className="inline-flex items-center gap-1.5 font-display text-[10px] tracking-wider text-gold border border-gold/30 px-3 py-1.5 rounded-lg bg-gold/5"
                    >
                      <i className="ti ti-player-play text-[13px]" />
                      Watch Recording
                    </button>
                  ) : (
                    <span className="font-body text-[11px] text-[#9ab0c4]">
                      No media file attached
                    </span>
                  )}

                  {m.hasTranscript && (
                    <span className="inline-flex items-center gap-1.5 font-display text-[10px] tracking-wider text-green-700 border border-green-200 px-3 py-1.5 rounded-lg bg-green-50">
                      <i className="ti ti-file-text text-[13px]" />
                      Transcript Available
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}