'use client'

import { useEffect, useState } from 'react'
import { STATUS_STYLE } from '../data/mockData'

type TranscriptionRecord = {
  id: number
  massTitle: string
  priest: string
  date: string
  duration: string
  category: string
  transcriptText: string | null
  summaryText: string | null
  transcriptFilename: string | null
  transcriptFilepath: string | null
  words: number
}

export default function TranscriptionsPage() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadTranscriptions = async () => {
    try {
      setLoading(true)

      const res = await fetch('/api/backend/api/transcriptions')

      if (!res.ok) {
        throw new Error('Failed to load transcriptions')
      }

      const data = await res.json()
      setTranscriptions(data.transcriptions || [])
    } catch (err) {
      console.error('Load admin transcriptions error:', err)
      alert('Cannot load transcriptions. The parish backend service is unavailable.')
      setTranscriptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTranscriptions()
  }, [])

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        Transcriptions
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        All completed AI-generated transcriptions and sermon summaries.
      </p>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
            <p className="font-body text-[#9ab0c4] text-[13px]">
              Loading transcriptions...
            </p>
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
            <i className="ti ti-file-text text-gold/30 text-5xl mb-3 block" />

            <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
              No completed transcriptions yet
            </p>

            <p className="font-body text-[#9ab0c4] text-[13px]">
              Run AI Transcribe from Mass Recordings, or save a transcript manually.
            </p>
          </div>
        ) : (
          transcriptions.map(t => (
            <div key={t.id} className="bg-white border border-gold/20 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-file-text text-gold text-[16px]" />
                  </div>

                  <div>
                    <p className="font-display text-navy-mid text-[13px] font-semibold">
                      {t.massTitle}
                    </p>

                    <p className="font-body text-[#9ab0c4] text-[11px]">
                      {t.priest || 'No priest'} · {t.date || 'No date'} · {t.duration || 'No duration'}
                    </p>
                  </div>
                </div>

                <span className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${STATUS_STYLE.Transcribed}`}>
                  Transcribed
                </span>
              </div>

              <div className="mt-4 border-l-2 border-gold/30 pl-4">
                <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase mb-1">
                  Summary
                </p>

                <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed italic">
                  "{t.summaryText || 'No summary available.'}"
                </p>
              </div>

              {expanded === t.id && (
                <div className="mt-4 border-t border-gold/10 pt-4">
                  <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase mb-2">
                    Full Transcript
                  </p>

                  <div className="bg-gold/5 border border-gold/10 rounded-xl p-4 max-h-80 overflow-auto">
                    <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed whitespace-pre-wrap">
                      {t.transcriptText || 'No transcript text available.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg"
                >
                  <i className={`ti ${expanded === t.id ? 'ti-eye-off' : 'ti-eye'} text-[13px]`} />
                  {expanded === t.id ? 'Hide Transcript' : 'View Transcript'}
                </button>

                {t.transcriptFilepath && (
                  <a
                    href={`/api/backend/download/${t.transcriptFilepath}`}
                    className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg"
                  >
                    <i className="ti ti-download text-[13px]" />
                    Export PDF
                  </a>
                )}

                <button
                  onClick={() => alert('Edit this from Admin → Mass Recordings → Eye button.')}
                  className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg"
                >
                  <i className="ti ti-edit text-[13px]" />
                  Edit
                </button>

                <span className="ml-auto font-display text-[10px] tracking-wider bg-gold/10 text-gold border border-gold/25 px-2.5 py-1.5 rounded-full">
                  {(t.words || 0).toLocaleString()} words
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}