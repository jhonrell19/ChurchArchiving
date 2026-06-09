'use client'
import { TRANSCRIPTIONS } from '../data/mockData'

export default function TranscriptionsPage() {
  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">AI Transcriptions & Summaries</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">AI-generated transcriptions and sermon summaries from archived masses.</p>
      <div className="space-y-4">
        {TRANSCRIPTIONS.map(t => (
          <div key={t.id} className="bg-white border border-gold/20 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="font-display text-navy-mid text-[14px] font-semibold">{t.massTitle}</p>
                <p className="font-body text-[#6b8caa] text-[12px] mt-0.5">{t.priest} · {t.date}</p>
              </div>
              <span className="flex-shrink-0 font-display text-[10px] tracking-wider bg-gold/10 text-gold border border-gold/25 px-2.5 py-0.5 rounded-full">
                {t.words.toLocaleString()} words
              </span>
            </div>
            <div className="border-l-2 border-gold/30 pl-4 mt-3">
              <p className="font-body text-[13px] text-[#4a6a8a] leading-relaxed italic">"{t.summary}"</p>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-gold border border-gold/30 px-3 py-1.5 rounded-lg bg-gold/5">
                <i className="ti ti-file-text text-[14px]" aria-hidden="true" /> Read Full Transcript
              </button>
              <button className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg">
                <i className="ti ti-download text-[14px]" aria-hidden="true" /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}