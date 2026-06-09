import type { MassRecord } from '../types'

export default function MassCard({ m }: { m: MassRecord }) {
  return (
    <div className="bg-white border border-gold/20 rounded-xl overflow-hidden">
      <div className="relative bg-navy h-36 flex items-center justify-center">
        <i className="ti ti-player-play text-gold text-3xl" aria-hidden="true" />
        <p className="absolute bottom-2 right-3 font-body text-gold/50 text-[11px]">{m.duration}</p>
        {m.hasTranscript && (
          <span className="absolute top-3 right-3 bg-gold/90 text-navy font-display text-[10px] tracking-wider px-2 py-0.5 rounded-full">
            AI Transcript
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-display text-navy-mid text-[13px] font-semibold mb-1 leading-snug">{m.title}</p>
        <p className="font-body text-[#6b8caa] text-[12px] mb-3">{m.priest}</p>
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] tracking-wider bg-gold/10 text-gold border border-gold/25 px-2.5 py-0.5 rounded-full">{m.category}</span>
          <span className="font-body text-[11px] text-[#9ab0c4]">{m.date}</span>
        </div>
      </div>
    </div>
  )
}