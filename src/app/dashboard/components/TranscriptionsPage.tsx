'use client'

import { useEffect, useState } from 'react'

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
      console.warn('Load transcriptions error:', err)
      setTranscriptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadTranscriptions())
  }, [])

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">
        AI Transcriptions & Summaries
      </h2>

      <p className="font-body text-[#6b8caa] text-[14px] mb-6">
        AI-generated transcriptions and sermon summaries from archived masses.
      </p>

      {loading ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <p className="font-body text-[#9ab0c4] text-[14px]">
            Loading transcriptions...
          </p>
        </div>
      ) : transcriptions.length === 0 ? (
        <div className="bg-white border border-gold/20 rounded-xl p-12 text-center">
          <i className="ti ti-file-text text-gold/30 text-5xl mb-3 block" />

          <p className="font-display text-navy-mid text-[14px] font-semibold mb-1">
            No transcribed masses yet
          </p>

          <p className="font-body text-[#9ab0c4] text-[13px]">
            Transcriptions will appear here after the admin runs AI Transcribe or saves a transcript.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcriptions.map(t => (
            <div key={t.id} className="bg-white border border-gold/20 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-display text-navy-mid text-[14px] font-semibold">
                    {t.massTitle}
                  </p>

                  <p className="font-body text-[#6b8caa] text-[12px] mt-0.5">
                    {t.priest || 'No priest assigned'} · {t.date || 'No date'}
                  </p>
                </div>

                <span className="flex-shrink-0 font-display text-[10px] tracking-wider bg-gold/10 text-gold border border-gold/25 px-2.5 py-0.5 rounded-full">
                  {(t.words || 0).toLocaleString()} words
                </span>
              </div>

              <div className="border-l-2 border-gold/30 pl-4 mt-3">
                <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed italic">
                  {'“'}{t.summaryText || 'No summary available.'}{'”'}
                </p>
              </div>

              {expanded === t.id && (
                <div className="mt-4 border-t border-gold/10 pt-4">
                  <p className="font-display text-navy-mid text-[12px] font-semibold mb-2">
                    Full Transcript
                  </p>

                  <div className="bg-gold/5 border border-gold/10 rounded-xl p-4 max-h-80 overflow-auto">
                    <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed whitespace-pre-wrap">
                      {t.transcriptText || 'No transcript text available.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4 flex-wrap">
                <button
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-gold border border-gold/30 px-3 py-1.5 rounded-lg bg-gold/5"
                >
                  <i className="ti ti-file-text text-[14px]" />
                  {expanded === t.id ? 'Hide Transcript' : 'Read Full Transcript'}
                </button>

                {t.transcriptFilepath ? (
                  <a
                    href={`/api/backend/download/${t.transcriptFilepath}`}
                    className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg"
                  >
                    <i className="ti ti-download text-[14px]" />
                    Download PDF
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#9ab0c4] border border-gold/15 px-3 py-1.5 rounded-lg opacity-60"
                  >
                    <i className="ti ti-download text-[14px]" />
                    No PDF
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}