'use client'
import { MASSES_LIST, STATUS_STYLE } from '../data/mockData'

export default function TranscriptionsPage() {
  const done = MASSES_LIST.filter(m => m.status === 'Transcribed')
  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">Transcriptions</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">All completed AI-generated transcriptions and sermon summaries.</p>
      <div className="space-y-4">
        {done.map(m => (
          <div key={m.id} className="bg-white border border-gold/20 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-file-text text-gold text-[16px]" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-display text-navy-mid text-[13px] font-semibold">{m.title}</p>
                  <p className="font-body text-[#9ab0c4] text-[11px]">{m.priest} · {m.date} · {m.duration}</p>
                </div>
              </div>
              <span className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status]}`}>{m.status}</span>
            </div>
            <div className="flex gap-2 mt-4">
              {[['ti-eye', 'View Transcript'], ['ti-download', 'Export'], ['ti-edit', 'Edit']].map(([icon, label]) => (
                <button key={label} className="flex items-center gap-1.5 font-display text-[11px] tracking-wider text-[#6b8caa] border border-gold/15 px-3 py-1.5 rounded-lg">
                  <i className={`ti ${icon} text-[13px]`} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}